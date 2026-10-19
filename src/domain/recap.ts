import { summarise } from './analytics'
import type { TxnLite } from './analytics'
import { shiftMonth } from './budgetMath'

export interface RecapCategory { categoryId: string | null; total: number; delta: number }

export interface PersonRecap {
  spend: number
  income: number
  /** income − spend (negative = spent more than came in) */
  net: number
  spendDelta: number
  topCategories: RecapCategory[]
  /** the categories that moved most against last month, either way */
  movers: RecapCategory[]
  biggest: { description: string; amount: number; date: string } | null
}

function monthRange(month: string): { from: string; to: string } {
  const [y, m] = month.split('-').map(Number)
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, '0')}` }
}

/**
 * One person's month at a glance, against the month before. Pass
 * split-expanded rows that cover both months.
 */
export function buildRecap(txns: (TxnLite & { description: string })[], month: string, excluded: Set<string>): PersonRecap {
  const cur = monthRange(month)
  const prev = monthRange(shiftMonth(month, -1))
  const now = summarise(txns, cur.from, cur.to, excluded)
  const before = summarise(txns, prev.from, prev.to, excluded)
  const prevBy = new Map(before.byCategory.map((c) => [c.categoryId, c.total]))
  const all = new Set([...now.byCategory.map((c) => c.categoryId), ...before.byCategory.map((c) => c.categoryId)])
  const withDelta = [...all].map((id) => {
    const total = now.byCategory.find((c) => c.categoryId === id)?.total ?? 0
    return { categoryId: id, total, delta: Math.round((total - (prevBy.get(id) ?? 0)) * 100) / 100 }
  })
  const spends = txns.filter((t) => t.amount < 0 && t.txn_date >= cur.from && t.txn_date <= cur.to && !(t.category_id && excluded.has(t.category_id)))
  const big = spends.reduce<(typeof spends)[number] | null>((a, t) => (!a || t.amount < a.amount ? t : a), null)
  return {
    spend: now.spend,
    income: now.income,
    net: Math.round((now.income - now.spend) * 100) / 100,
    spendDelta: Math.round((now.spend - before.spend) * 100) / 100,
    topCategories: withDelta.filter((c) => c.total > 0).sort((a, b) => b.total - a.total).slice(0, 3),
    movers: withDelta.filter((c) => Math.abs(c.delta) >= 20).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 3),
    biggest: big ? { description: big.description, amount: big.amount, date: big.txn_date } : null,
  }
}
