import { BANK_PROFILES, applyProfile } from './bankProfiles'
import type { BankProfile, ParsedTxn } from './bankProfiles'
import { parseAmount, parseAuDate, parseDayMonDate } from './money'

export type FileFormat = 'csv' | 'ofx' | 'qif'

/** By extension first, then by sniffing the first bytes (some banks name OFX files .txt). */
export function detectFormat(filename: string, text: string): FileFormat {
  const ext = filename.toLowerCase().split('.').pop() ?? ''
  if (ext === 'ofx' || ext === 'qfx') return 'ofx'
  if (ext === 'qif') return 'qif'
  const head = text.slice(0, 400).toUpperCase()
  if (head.includes('OFXHEADER') || head.includes('<OFX>')) return 'ofx'
  if (/^\s*!TYPE:/i.test(text)) return 'qif'
  return 'csv'
}

// Header words only one bank uses — checked before falling back to "which profile parses most rows".
const HEADER_SIGNATURES: { id: string; test: (h: string[]) => boolean }[] = [
  { id: 'westpac', test: (h) => h.includes('narrative') && h.includes('bank account') },
  { id: 'macquarie', test: (h) => h.includes('details') && h.includes('debit') && h.includes('credit') && h[0].includes('date') },
  { id: 'ing', test: (h) => h[0] === 'date' && h[1] === 'description' && h[2] === 'credit' && h[3] === 'debit' },
  { id: 'nab', test: (h) => h.includes('transaction details') && h.includes('account number') },
]

// When nothing in the header gives it away, the stricter profiles get first go.
const PRIORITY = ['macquarie', 'westpac', 'ing', 'nab', 'commbank']

/**
 * Which bank export is this? Returns null when no preset fits (the custom
 * column mapping takes over). A profile must parse ≥ 90% of the data rows.
 */
export function detectBankProfile(rows: string[][]): BankProfile | null {
  if (rows.length === 0) return null
  const header = rows[0].map((c) => c.trim().toLowerCase())
  const signed = HEADER_SIGNATURES.find((s) => s.test(header))
  if (signed) {
    const p = BANK_PROFILES.find((b) => b.id === signed.id)
    if (p && applyProfile(rows, p).length > 0) return p
  }
  // a first row that already holds a date is data, so header-row presets can't apply
  const firstRowIsData = rows[0].some((c) => parseAuDate(c) !== null || parseDayMonDate(c) !== null)
  let best: { p: BankProfile; score: number } | null = null
  for (const id of PRIORITY) {
    const p = BANK_PROFILES.find((b) => b.id === id)
    if (!p || (p.hasHeader && firstRowIsData)) continue
    const dataRows = p.hasHeader ? rows.length - 1 : rows.length
    if (dataRows <= 0) continue
    // a header-less profile can still meet a header row it can't parse — don't count it against it
    const parsed = applyProfile(rows, p).length
    const looksLikeHeader = !p.hasHeader && p.parse(rows[0]) === null
    const score = parsed / (looksLikeHeader ? Math.max(1, dataRows - 1) : dataRows)
    if (score >= 0.9 && (!best || score > best.score)) best = { p, score }
  }
  return best?.p ?? null
}

// ── OFX / QFX ────────────────────────────────────────────────────────────────

function ofxTag(block: string, tag: string): string | undefined {
  // OFX 1.x is SGML (no closing tags); 2.x is XML. Read up to the next tag either way.
  const m = new RegExp(`<${tag}>([^<\\r\\n]*)`, 'i').exec(block)
  return m?.[1].trim() || undefined
}

function ofxDate(raw: string | undefined): string | null {
  const m = raw?.match(/^(\d{4})(\d{2})(\d{2})/)
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null
}

function decodeEntities(s: string): string {
  return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
}

/**
 * Transactions from an OFX/QFX statement. The ledger balance rides on the
 * newest row; BANKID (the BSB in Australian files) + ACCTID become each row's
 * account identifier so the file routes itself to the right account.
 */
export function parseOfx(text: string): ParsedTxn[] {
  const out: ParsedTxn[] = []
  const acctFrom = text.split(/<BANKACCTFROM>|<CCACCTFROM>/i)[1]
  const ref = acctFrom ? `${ofxTag(acctFrom, 'BANKID') ?? ''}${ofxTag(acctFrom, 'ACCTID') ?? ''}`.replace(/\D/g, '') : ''
  const blocks = text.split(/<STMTTRN>/i).slice(1)
  for (const raw of blocks) {
    const block = raw.split(/<\/STMTTRN>/i)[0]
    const dateIso = ofxDate(ofxTag(block, 'DTPOSTED'))
    const amount = parseAmount(ofxTag(block, 'TRNAMT') ?? '')
    const name = ofxTag(block, 'NAME')
    const memo = ofxTag(block, 'MEMO')
    const description = decodeEntities(name && memo && !memo.startsWith(name) ? `${name} ${memo}` : name ?? memo ?? '')
    if (!dateIso || amount === null || !description) continue
    out.push(ref ? { dateIso, amount, description, accountRef: ref } : { dateIso, amount, description })
  }
  const ledger = text.split(/<LEDGERBAL>/i)[1]
  const balance = ledger ? parseAmount(ofxTag(ledger, 'BALAMT') ?? '') : null
  if (balance !== null && out.length > 0) {
    const newest = out.reduce((a, b) => (b.dateIso > a.dateIso ? b : a))
    newest.balance = balance
  }
  return out
}

// ── QIF ──────────────────────────────────────────────────────────────────────

/** dd/mm/yyyy, dd/mm'yy or dd-mm-yyyy — Australian banks export day-first. */
function qifDate(raw: string): string | null {
  return parseAuDate(raw.trim().replace(/'/g, '/').replace(/-/g, '/').replace(/\s+/g, ''))
}

/** Transactions from a QIF file (one record per "^"-terminated block). */
export function parseQif(text: string): ParsedTxn[] {
  const out: ParsedTxn[] = []
  let date: string | null = null
  let amount: number | null = null
  let payee = ''
  let memo = ''
  for (const line of text.split(/\r?\n/)) {
    const code = line[0]
    const val = line.slice(1).trim()
    if (code === 'D') date = qifDate(val)
    else if (code === 'T' || code === 'U') amount = parseAmount(val)
    else if (code === 'P') payee = val
    else if (code === 'M') memo = val
    else if (code === '^') {
      const description = payee || memo
      if (date && amount !== null && description) out.push({ dateIso: date, amount, description })
      date = null
      amount = null
      payee = ''
      memo = ''
    }
  }
  return out
}

/** Per-bank "how do I get the file" help, shown on the Import screen. */
export const EXPORT_HELP: Record<string, string> = {
  commbank: 'NetBank (web) → View accounts → pick the account → Export → CSV.',
  westpac: 'Online Banking (web) → Accounts → Transactions → Export → CSV (all accounts in one file works).',
  nab: 'NAB Internet Banking (web) → Transactions → Export → CSV.',
  macquarie: 'Macquarie Online (web) → account → Transactions → Export → CSV.',
  ing: 'ING app or web → account → Export transactions → CSV.',
  generic: 'Most banks offer CSV, OFX or QIF under "Export" on the transactions page of their website.',
}
