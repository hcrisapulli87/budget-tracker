import { summarise } from './analytics'
import type { TxnLite } from './analytics'
import { merchantLeaderboard } from './stats'
import { shiftMonth } from './budgetMath'
import { goalStatus } from './goals'
import { groupNetWorth, kindInfo } from './netWorth'
import type { RecurringItem } from './recurring'
import type { Forecast, PayCycle, SafeToSpend } from './forecast'
import type { Account, Budget, Category, Goal, Txn } from '../data/types'

export interface AskInput {
  today: string
  /** split-expanded rows for category maths */
  expanded: TxnLite[]
  /** original rows for merchant counts */
  txns: Txn[]
  categories: Category[]
  budgets: Budget[]
  goals: Goal[]
  recurring: RecurringItem[]
  accounts: Account[]
  pay: PayCycle | null
  safe: SafeToSpend | null
  forecast: Forecast | null
  months?: number
}

const r2 = (n: number) => Math.round(n * 100) / 100

/**
 * The snapshot sent to the Ask assistant: aggregates only — monthly totals by
 * category, budgets, goals, recurring, balances by kind, a forecast summary
 * and the top merchants. Never raw transaction rows, notes or account numbers.
 */
export function buildAskContext(input: AskInput) {
  const months = input.months ?? 6
  const month = input.today.slice(0, 7)
  const excluded = new Set(input.categories.filter((c) => c.exclude_from_analytics).map((c) => c.id))
  const catName = (id: string | null) => input.categories.find((c) => c.id === id)?.name ?? 'Uncategorised'
  const monthList = Array.from({ length: months }, (_, i) => shiftMonth(month, i - months + 1))

  const byMonth = monthList.map((m) => {
    const [y, mo] = m.split('-').map(Number)
    const last = new Date(Date.UTC(y, mo, 0)).getUTCDate()
    const s = summarise(input.expanded, `${m}-01`, `${m}-${String(last).padStart(2, '0')}`, excluded)
    return {
      month: m + (m === month ? ' (so far)' : ''),
      spend: s.spend,
      income: s.income,
      byCategory: Object.fromEntries(s.byCategory.slice(0, 12).map((c) => [catName(c.categoryId), c.total])),
    }
  })

  const thisMonthSpend = new Map<string, number>()
  for (const t of input.expanded) {
    if (t.amount < 0 && t.category_id && t.txn_date.startsWith(month)) thisMonthSpend.set(t.category_id, (thisMonthSpend.get(t.category_id) ?? 0) - t.amount)
  }

  const from = `${monthList[0]}-01`
  const nw = groupNetWorth(input.accounts)
  return {
    today: input.today,
    currency: 'AUD',
    months: byMonth,
    budgets: input.budgets.map((b) => ({
      category: catName(b.category_id),
      monthlyLimit: b.monthly_limit,
      spentThisMonth: r2(thisMonthSpend.get(b.category_id) ?? 0),
      rollsOver: !!b.rollover,
    })),
    goals: input.goals.map((g) => {
      const s = goalStatus(g, input.today)
      return { name: g.name, joint: g.owner_id === null, target: g.target_amount, saved: g.saved_amount, targetDate: g.target_date, monthlyNeeded: s.monthlyNeeded, status: s.status }
    }),
    recurring: input.recurring.map((i) => ({ name: i.name, amount: i.amount, perMonth: r2(i.monthly), next: i.next, kind: i.kind === 'bill' ? 'bill' : 'subscription' })),
    netWorth: { assets: nw.assets, liabilities: nw.liabilities, net: nw.net, byKind: Object.fromEntries(nw.groups.map((g) => [kindInfo(g.kind).label, g.total])) },
    pay: input.pay ? { cadence: input.pay.cadence, amount: input.pay.amount, nextPayday: input.pay.nextPayday } : null,
    safeToSpendUntilPayday: input.safe ? { amount: input.safe.amount, perDay: input.safe.perDay, billsBeforePayday: input.safe.committed } : null,
    forecast60d: input.forecast ? { lowest: input.forecast.lowest, end: input.forecast.end } : null,
    topMerchants: merchantLeaderboard(input.txns, from, `${month}-31`, excluded, 15).map((m) => ({ name: m.label, total: r2(m.total), visits: m.count })),
  }
}
