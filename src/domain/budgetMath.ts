export interface BudgetPace {
  expected: number
  status: 'over' | 'hot' | 'ontrack'
}

/** Where the month's spend *should* be by today, and whether we're past it. */
export function budgetPace(spent: number, limit: number, dayOfMonth: number, daysInMonth: number): BudgetPace {
  const expected = limit * (dayOfMonth / daysInMonth)
  const status = spent > limit ? 'over' : spent > expected * 1.1 ? 'hot' : 'ontrack'
  return { expected, status }
}

/** "2026-03" + n months → "2026-05" (n may be negative). */
export function shiftMonth(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number)
  const t = y * 12 + (m - 1) + n
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`
}

/**
 * Rollover budgets: what carries into `currentMonth` from every full month
 * since `fromMonth` — unspent limit adds to this month, overspend eats into it.
 * Months with no spend recorded count as fully unspent.
 */
export function rolloverCarry(limit: number, spentByMonth: Map<string, number>, fromMonth: string, currentMonth: string): number {
  let carry = 0
  for (let m = fromMonth; m < currentMonth; m = shiftMonth(m, 1)) carry += limit - (spentByMonth.get(m) ?? 0)
  return Math.round(carry * 100) / 100
}

interface BudgetLike {
  category_id: string
  monthly_limit: number
  rollover?: boolean
  rollover_from?: string | null
}

/** Rollover history is capped so one old start date can't pull years of rows. */
export const MAX_ROLLOVER_MONTHS = 24

/** First month any of these budgets needs spend history from. */
export function earliestBudgetMonth(budgets: BudgetLike[], month: string): string {
  const floor = shiftMonth(month, -MAX_ROLLOVER_MONTHS)
  const min = budgets
    .filter((b) => b.rollover && b.rollover_from)
    .map((b) => b.rollover_from!.slice(0, 7))
    .reduce((a, b) => (b < a ? b : a), month)
  return min < floor ? floor : min
}

/** category → month (yyyy-mm) → spend. Pass split-expanded rows. */
export function spendByCategoryMonth(txns: { amount: number; category_id: string | null; txn_date: string }[]): Map<string, Map<string, number>> {
  const m = new Map<string, Map<string, number>>()
  for (const t of txns) {
    if (t.amount >= 0 || !t.category_id) continue
    const byMonth = m.get(t.category_id) ?? new Map<string, number>()
    const key = t.txn_date.slice(0, 7)
    byMonth.set(key, (byMonth.get(key) ?? 0) - t.amount)
    m.set(t.category_id, byMonth)
  }
  return m
}

/** This month's spend vs what's available (limit + any rolled-over carry). */
export function budgetUsage<B extends BudgetLike>(b: B, spend: Map<string, Map<string, number>>, month: string): B & { spent: number; carry: number; available: number } {
  const byMonth = spend.get(b.category_id) ?? new Map<string, number>()
  const from = b.rollover && b.rollover_from ? b.rollover_from.slice(0, 7) : month
  const floor = shiftMonth(month, -MAX_ROLLOVER_MONTHS)
  const carry = b.rollover ? rolloverCarry(b.monthly_limit, byMonth, from < floor ? floor : from, month) : 0
  return { ...b, spent: byMonth.get(month) ?? 0, carry, available: Math.max(0, b.monthly_limit + carry) }
}
