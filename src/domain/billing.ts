import type { BillFrequency } from '../data/types'

export function addMonthsClamped(iso: string, months: number, dueDay: number): string {
  const [y, m] = iso.split('-').map(Number)
  const total = y * 12 + (m - 1) + months
  const year = Math.floor(total / 12)
  const month = total % 12
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  const day = Math.min(dueDay, lastDay)
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function advanceDue(nextDue: string, frequency: BillFrequency, dueDay: number): string {
  const months = frequency === 'monthly' ? 1 : frequency === 'quarterly' ? 3 : 12
  return addMonthsClamped(nextDue, months, dueDay)
}

export interface MatchableTxn {
  id: string
  txn_date: string
  amount: number
  description: string
}

/** Paid-bill matcher: spend within ±4 days of due and ±10% of the bill amount. */
export function suggestMatch(bill: { amount: number; next_due: string }, txns: MatchableTxn[]): MatchableTxn | null {
  const due = Date.parse(bill.next_due)
  let best: MatchableTxn | null = null
  let bestScore = Infinity
  for (const t of txns) {
    if (t.amount >= 0) continue
    const daysOff = Math.abs(Date.parse(t.txn_date) - due) / 86_400_000
    const amountOff = Math.abs(Math.abs(t.amount) - bill.amount)
    if (daysOff > 4 || amountOff > bill.amount * 0.1) continue
    const score = daysOff + amountOff / bill.amount
    if (score < bestScore) {
      best = t
      bestScore = score
    }
  }
  return best
}
