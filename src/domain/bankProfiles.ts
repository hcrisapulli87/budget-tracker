import { parseAmount, parseAuDate, parseDayMonDate } from './money'

export interface ParsedTxn {
  dateIso: string
  amount: number
  description: string
  /** Running account balance after this transaction, when the export includes one. */
  balance?: number
}

export interface BankProfile {
  id: string
  label: string
  hasHeader: boolean
  /** header is the raw header row when hasHeader — profiles whose banks move columns between exports resolve indices from it. */
  parse(cols: string[], header?: string[]): ParsedTxn | null
}

function parseDate(raw: string, style: 'dmy' | 'iso'): string | null {
  if (style === 'iso') return /^\d{4}-\d{2}-\d{2}$/.test(raw.trim()) ? raw.trim() : null
  return parseAuDate(raw)
}

/** debit/credit pair → signed amount (debit = spend = negative). */
function signedFrom(debitRaw: string | undefined, creditRaw: string | undefined): number | null {
  const credit = creditRaw === undefined ? null : parseAmount(creditRaw)
  const debit = debitRaw === undefined ? null : parseAmount(debitRaw)
  if (credit !== null && credit !== 0) return Math.abs(credit)
  if (debit !== null && debit !== 0) return -Math.abs(debit)
  return null
}

/** Optional running-balance column — undefined (not null) when absent/unparseable. */
function balanceFrom(raw: string | undefined): number | undefined {
  const b = raw === undefined ? null : parseAmount(raw)
  return b === null ? undefined : b
}

export const BANK_PROFILES: BankProfile[] = [
  {
    id: 'commbank',
    label: 'CommBank (Date, Amount, Description, Balance)',
    hasHeader: false,
    parse(cols) {
      if (cols.length < 3) return null
      const dateIso = parseAuDate(cols[0])
      const amount = parseAmount(cols[1])
      if (!dateIso || amount === null) return null
      return { dateIso, amount, description: cols[2].trim(), balance: balanceFrom(cols[3]) }
    },
  },
  {
    id: 'westpac',
    label: 'Westpac (Account, Date, Narrative, Debit, Credit, …)',
    hasHeader: true,
    parse(cols) {
      if (cols.length < 5) return null
      const dateIso = parseAuDate(cols[1])
      const amount = signedFrom(cols[3], cols[4])
      if (!dateIso || amount === null) return null
      return { dateIso, amount, description: cols[2].trim(), balance: balanceFrom(cols[5]) }
    },
  },
  {
    id: 'nab',
    // NAB's TransactionHistory.csv has no header; dates look like "15 Jul 25".
    label: 'NAB (Date, Amount, Account, Type, Details, Balance)',
    hasHeader: false,
    parse(cols) {
      if (cols.length < 6) return null
      const dateIso = parseDayMonDate(cols[0]) ?? parseAuDate(cols[0])
      const amount = parseAmount(cols[1])
      if (!dateIso || amount === null) return null
      return { dateIso, amount, description: cols[5].trim(), balance: balanceFrom(cols[6]) }
    },
  },
  {
    id: 'macquarie',
    // Macquarie's column set varies between exports (Tags/Notes/Original
    // Description come and go), so positions are resolved from the header row.
    label: 'Macquarie (Date, Details, …, Debit, Credit, Balance)',
    hasHeader: true,
    parse(cols, header) {
      const col = (name: string) => header?.findIndex((h) => h.trim().toLowerCase() === name) ?? -1
      const debitIdx = col('debit')
      const creditIdx = col('credit')
      if (debitIdx < 0 || creditIdx < 0) return null
      const dateIso = parseDayMonDate(cols[0]) ?? parseAuDate(cols[0])
      const amount = signedFrom(cols[debitIdx], cols[creditIdx])
      if (!dateIso || amount === null) return null
      // "Original Description" is the stable bank narrative; "Details" embeds
      // per-transaction receipt numbers that would defeat merchant rules.
      const origIdx = col('original description')
      const description = (origIdx >= 0 ? cols[origIdx]?.trim() : '') || cols[1].trim()
      const balanceIdx = col('balance')
      return { dateIso, amount, description, balance: balanceIdx >= 0 ? balanceFrom(cols[balanceIdx]) : undefined }
    },
  },
  {
    id: 'ing',
    label: 'ING (Date, Description, Credit, Debit, Balance)',
    hasHeader: true,
    parse(cols) {
      if (cols.length < 4) return null
      const dateIso = parseAuDate(cols[0])
      const amount = signedFrom(cols[3], cols[2])
      if (!dateIso || amount === null) return null
      return { dateIso, amount, description: cols[1].trim(), balance: balanceFrom(cols[4]) }
    },
  },
]

export interface ColumnMapping {
  hasHeader: boolean
  dateCol: number
  descCol: number
  amountCol?: number
  debitCol?: number
  creditCol?: number
  dateStyle: 'dmy' | 'iso'
}

/** "Map your own columns" fallback for any bank export we don't have a preset for. */
export function genericProfile(m: ColumnMapping): BankProfile {
  return {
    id: 'generic',
    label: 'Custom mapping',
    hasHeader: m.hasHeader,
    parse(cols) {
      const dateIso = parseDate(cols[m.dateCol] ?? '', m.dateStyle)
      const description = (cols[m.descCol] ?? '').trim()
      const amount =
        m.amountCol !== undefined
          ? parseAmount(cols[m.amountCol] ?? '')
          : signedFrom(
              m.debitCol !== undefined ? cols[m.debitCol] : undefined,
              m.creditCol !== undefined ? cols[m.creditCol] : undefined,
            )
      if (!dateIso || amount === null || !description) return null
      return { dateIso, amount, description }
    },
  }
}

export function applyProfile(rows: string[][], profile: BankProfile): ParsedTxn[] {
  const header = profile.hasHeader ? rows[0] : undefined
  const body = profile.hasHeader ? rows.slice(1) : rows
  return body.map((r) => profile.parse(r, header)).filter((t): t is ParsedTxn => t !== null)
}

/**
 * Balance of the most recent transaction in an export — used to auto-update the
 * account's balance on import. Banks disagree on row order (CommBank/NAB export
 * newest-first, others oldest-first), so among rows sharing the latest date we
 * trust file order: in a newest-first file the first row wins, otherwise the last.
 */
export function latestBalance(parsed: ParsedTxn[]): { balance: number; dateIso: string } | null {
  const withBalance = parsed.filter((t) => t.balance !== undefined)
  if (withBalance.length === 0) return null
  const latest = withBalance.reduce((max, t) => (t.dateIso > max ? t.dateIso : max), withBalance[0].dateIso)
  const ties = withBalance.filter((t) => t.dateIso === latest)
  const newestFirst = parsed[0].dateIso >= parsed[parsed.length - 1].dateIso
  const row = newestFirst ? ties[0] : ties[ties.length - 1]
  return { balance: row.balance!, dateIso: row.dateIso }
}
