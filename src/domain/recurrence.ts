import { addDaysIso } from './money'
import type { Cadence } from '../data/types'

const CADENCES: { cadence: Cadence; min: number; max: number; step: number }[] = [
  { cadence: 'weekly', min: 6, max: 8, step: 7 },
  { cadence: 'fortnightly', min: 12, max: 16, step: 14 },
  { cadence: 'monthly', min: 27, max: 34, step: 30 },
  { cadence: 'quarterly', min: 80, max: 100, step: 91 },
  { cadence: 'annual', min: 340, max: 390, step: 365 },
]

const dayDiff = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000)

export interface RecurringInput {
  merchant_norm: string
  txn_date: string
  amount: number
}

export interface CandidateSub {
  merchantNorm: string
  cadence: Cadence
  amount: number
  lastDate: string
  nextExpected: string
}

/**
 * A merchant is a subscription candidate when it has ≥3 spends of ~equal amount
 * (±10% of median) at one steady cadence. Deliberately conservative: misses are
 * cheaper than false alarms — anything missed shows up again next cycle.
 */
export function detectRecurring(txns: RecurringInput[]): CandidateSub[] {
  const groups = new Map<string, RecurringInput[]>()
  for (const t of txns) {
    if (t.amount >= 0 || !t.merchant_norm) continue
    const g = groups.get(t.merchant_norm) ?? []
    g.push(t)
    groups.set(t.merchant_norm, g)
  }

  const out: CandidateSub[] = []
  for (const [merchant, g] of groups) {
    if (g.length < 3) continue
    g.sort((a, b) => a.txn_date.localeCompare(b.txn_date))

    const amounts = g.map((x) => Math.abs(x.amount)).sort((a, b) => a - b)
    const median = amounts[Math.floor(amounts.length / 2)]
    if (!amounts.every((a) => Math.abs(a - median) <= median * 0.1)) continue

    const gaps = g.slice(1).map((x, i) => dayDiff(g[i].txn_date, x.txn_date))
    const cadence = CADENCES.find((c) => gaps.every((d) => d >= c.min && d <= c.max))
    if (!cadence) continue

    const last = g[g.length - 1]
    out.push({
      merchantNorm: merchant,
      cadence: cadence.cadence,
      amount: Math.abs(last.amount),
      lastDate: last.txn_date,
      nextExpected: addDaysIso(last.txn_date, cadence.step),
    })
  }
  return out
}
