import { addDaysIso } from './money'
import { addMonthsClamped } from './billing'
import type { RecurringItem } from './recurring'
import type { Cadence, PayCadence } from '../data/types'

export interface PayCycle {
  cadence: PayCadence
  amount: number
  nextPayday: string
  /** merchant_norm of the payer, when detected from statements */
  payer: string | null
  source: 'detected' | 'manual'
}

interface IncomeTxn {
  merchant_norm: string
  txn_date: string
  amount: number
}

const PAY_BANDS: { cadence: PayCadence; min: number; max: number }[] = [
  { cadence: 'weekly', min: 6, max: 8 },
  { cadence: 'fortnightly', min: 12, max: 16 },
  { cadence: 'monthly', min: 27, max: 34 },
]
const PER_MONTH: Record<PayCadence, number> = { weekly: 52 / 12, fortnightly: 26 / 12, monthly: 1 }
const dayDiff = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000)

/** Step a date one cycle forward. Monthly keeps the day of month (clamped). */
export function stepDate(iso: string, cadence: Cadence): string {
  switch (cadence) {
    case 'weekly': return addDaysIso(iso, 7)
    case 'fortnightly': return addDaysIso(iso, 14)
    case 'monthly': return addMonthsClamped(iso, 1, Number(iso.slice(8, 10)))
    case 'quarterly': return addMonthsClamped(iso, 3, Number(iso.slice(8, 10)))
    case 'annual': return addMonthsClamped(iso, 12, Number(iso.slice(8, 10)))
  }
}

/** First date on the cycle that is on or after `fromIso`. */
export function rollForward(iso: string, cadence: Cadence, fromIso: string): string {
  let d = iso
  for (let i = 0; d < fromIso && i < 1000; i++) d = stepDate(d, cadence)
  return d
}

/**
 * Find the pay cycle in a person's money-in: a payer with ≥3 deposits at one
 * steady weekly/fortnightly/monthly rhythm (amounts within ±25% — pay varies
 * with overtime). The biggest such stream per month wins.
 */
export function detectPayCycle(txns: IncomeTxn[], todayIso: string): PayCycle | null {
  const groups = new Map<string, IncomeTxn[]>()
  for (const t of txns) {
    if (t.amount <= 0 || !t.merchant_norm) continue
    groups.set(t.merchant_norm, [...(groups.get(t.merchant_norm) ?? []), t])
  }
  let best: (PayCycle & { monthly: number }) | null = null
  for (const [payer, g] of groups) {
    if (g.length < 3) continue
    g.sort((a, b) => a.txn_date.localeCompare(b.txn_date))
    const recent = g.slice(-6)
    const amounts = recent.map((t) => t.amount).sort((a, b) => a - b)
    const median = amounts[Math.floor(amounts.length / 2)]
    if (!amounts.every((a) => Math.abs(a - median) <= median * 0.25)) continue
    const gaps = recent.slice(1).map((t, i) => dayDiff(recent[i].txn_date, t.txn_date))
    const band = PAY_BANDS.find((b) => gaps.every((d) => d >= b.min && d <= b.max))
    if (!band) continue
    const last = recent[recent.length - 1]
    // a stream that stopped more than two cycles ago isn't your pay any more
    if (dayDiff(last.txn_date, todayIso) > band.max * 2) continue
    const monthly = median * PER_MONTH[band.cadence]
    if (best && best.monthly >= monthly) continue
    best = {
      cadence: band.cadence,
      amount: Math.round(median * 100) / 100,
      nextPayday: rollForward(stepDate(last.txn_date, band.cadence), band.cadence, addDaysIso(todayIso, 1)),
      payer,
      source: 'detected',
      monthly,
    }
  }
  if (!best) return null
  const { monthly: _monthly, ...cycle } = best
  return cycle
}

export interface ForecastEvent {
  date: string
  /** signed: income positive, bills negative */
  amount: number
  label: string
  kind: 'pay' | 'bill' | 'sub'
}

/**
 * Every pay and recurring charge between from and to (inclusive). A bill
 * that's overdue and still unpaid is assumed to come out today; detected
 * subscriptions just roll on to their next date.
 */
export function projectEvents(items: RecurringItem[], pay: PayCycle | null, fromIso: string, toIso: string): ForecastEvent[] {
  const out: ForecastEvent[] = []
  for (const i of items) {
    if (!i.next) continue
    const cadence: Cadence = i.kind === 'bill' ? i.bill.frequency : i.sub.cadence
    const push = (date: string) => out.push({ date, amount: -Math.abs(i.amount), label: i.name, kind: i.kind })
    let d = i.next
    if (i.kind === 'bill' && d < fromIso) {
      push(fromIso) // overdue: still to pay
      d = stepDate(d, cadence)
    }
    d = rollForward(d, cadence, fromIso)
    for (let n = 0; d <= toIso && n < 400; n++, d = stepDate(d, cadence)) push(d)
  }
  if (pay) {
    for (let d = rollForward(pay.nextPayday, pay.cadence, fromIso), n = 0; d <= toIso && n < 400; d = stepDate(d, pay.cadence), n++) {
      out.push({ date: d, amount: pay.amount, label: 'Pay', kind: 'pay' })
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.amount - b.amount)
}

interface SpendTxn {
  txn_date: string
  amount: number
  category_id: string | null
  merchant_norm: string
}

/**
 * Average day-to-day spend over a window — everything going out except
 * transfers/excluded categories and the merchants that are already in the
 * recurring list (those are projected as events, so counting them twice
 * would make the forecast gloomier than reality).
 */
export function dailyDiscretionary(txns: SpendTxn[], fromIso: string, toIso: string, excluded: Set<string>, recurringMerchants: Set<string>): number {
  const days = Math.max(1, dayDiff(fromIso, toIso) + 1)
  let total = 0
  for (const t of txns) {
    if (t.amount >= 0 || t.txn_date < fromIso || t.txn_date > toIso) continue
    if (t.category_id && excluded.has(t.category_id)) continue
    if (recurringMerchants.has(t.merchant_norm)) continue
    total -= t.amount
  }
  return Math.round((total / days) * 100) / 100
}

export interface ForecastPoint {
  date: string
  balance: number
}

export interface Forecast {
  points: ForecastPoint[]
  lowest: ForecastPoint
  end: ForecastPoint
}

/** Day-by-day balance: today's balance, minus daily spend, plus/minus each event. */
export function projectBalance(startBalance: number, todayIso: string, days: number, events: ForecastEvent[], dailySpend: number): Forecast {
  const byDate = new Map<string, number>()
  for (const e of events) byDate.set(e.date, (byDate.get(e.date) ?? 0) + e.amount)
  const points: ForecastPoint[] = []
  let bal = startBalance
  for (let i = 0; i <= days; i++) {
    const d = addDaysIso(todayIso, i)
    bal += byDate.get(d) ?? 0
    if (i > 0) bal -= dailySpend
    points.push({ date: d, balance: Math.round(bal * 100) / 100 })
  }
  const lowest = points.reduce((lo, p) => (p.balance < lo.balance ? p : lo), points[0])
  return { points, lowest, end: points[points.length - 1] }
}

export interface SafeToSpend {
  /** What's free to spend between now and the day before payday. */
  amount: number
  perDay: number
  daysToPayday: number
  /** bills + subscriptions due before payday */
  committed: number
}

/**
 * "Safe to spend until payday": today's spendable balance, less everything
 * already committed before the next pay lands, less a safety buffer.
 */
export function safeToSpend(startBalance: number, todayIso: string, nextPayday: string, events: ForecastEvent[], buffer: number): SafeToSpend {
  const before = events.filter((e) => e.date >= todayIso && e.date < nextPayday && e.kind !== 'pay')
  const committed = before.reduce((s, e) => s - Math.min(0, e.amount), 0)
  const extraIn = before.reduce((s, e) => s + Math.max(0, e.amount), 0)
  const daysToPayday = Math.max(1, dayDiff(todayIso, nextPayday))
  const amount = Math.round((startBalance + extraIn - committed - buffer) * 100) / 100
  return { amount, perDay: Math.round((Math.max(0, amount) / daysToPayday) * 100) / 100, daysToPayday, committed: Math.round(committed * 100) / 100 }
}
