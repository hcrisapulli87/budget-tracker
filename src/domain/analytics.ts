import { addDaysIso } from './money'

export interface TxnLite {
  txn_date: string
  amount: number
  category_id: string | null
  owner_id: string
}

export interface Summary {
  spend: number
  income: number
  byCategory: { categoryId: string | null; total: number }[]
  byDay: { date: string; spend: number }[]
}

const round2 = (n: number) => Math.round(n * 100) / 100

export function summarise(txns: TxnLite[], fromIso: string, toIso: string, excludedCategoryIds: Set<string> = new Set()): Summary {
  const inRange = txns.filter(
    (t) =>
      t.txn_date >= fromIso &&
      t.txn_date <= toIso &&
      !(t.category_id !== null && excludedCategoryIds.has(t.category_id)),
  )
  let spend = 0
  let income = 0
  const catTotals = new Map<string | null, number>()
  const dayTotals = new Map<string, number>()

  for (const t of inRange) {
    if (t.amount < 0) {
      spend += -t.amount
      catTotals.set(t.category_id, (catTotals.get(t.category_id) ?? 0) + -t.amount)
      dayTotals.set(t.txn_date, (dayTotals.get(t.txn_date) ?? 0) + -t.amount)
    } else {
      income += t.amount
    }
  }

  const byDay: Summary['byDay'] = []
  for (let d = fromIso; d <= toIso; d = addDaysIso(d, 1)) {
    byDay.push({ date: d, spend: round2(dayTotals.get(d) ?? 0) })
  }

  return {
    spend: round2(spend),
    income: round2(income),
    byCategory: [...catTotals.entries()]
      .map(([categoryId, total]) => ({ categoryId, total: round2(total) }))
      .sort((a, b) => b.total - a.total),
    byDay,
  }
}
