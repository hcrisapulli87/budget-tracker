import { parseAmount, parseAuDate } from './money'

export interface ParsedTxn {
  dateIso: string
  amount: number
  description: string
}

export interface BankProfile {
  id: string
  label: string
  hasHeader: boolean
  parse(cols: string[]): ParsedTxn | null
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
      return { dateIso, amount, description: cols[2].trim() }
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
      return { dateIso, amount, description: cols[2].trim() }
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
      return { dateIso, amount, description: cols[1].trim() }
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
  const body = profile.hasHeader ? rows.slice(1) : rows
  return body.map((r) => profile.parse(r)).filter((t): t is ParsedTxn => t !== null)
}
