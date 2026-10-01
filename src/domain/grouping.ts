import type { Txn } from '../data/types'

export interface DayGroup {
  dateIso: string
  spend: number
  txns: Txn[]
}

/** Day buckets for the Activity list, newest first, preserving input order within a day. */
export function groupByDay(txns: Txn[]): DayGroup[] {
  const map = new Map<string, Txn[]>()
  for (const t of txns) map.set(t.txn_date, [...(map.get(t.txn_date) ?? []), t])
  return [...map.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([dateIso, rows]) => ({
      dateIso,
      spend: rows.reduce((s, t) => s + (t.amount < 0 ? -t.amount : 0), 0),
      txns: rows,
    }))
}

export interface MonthGroup {
  /** "2026-09" */
  month: string
  spend: number
  days: DayGroup[]
}

/** Month sections (newest first), each holding its day buckets — Activity's long list. */
export function groupByMonth(txns: Txn[]): MonthGroup[] {
  const months: MonthGroup[] = []
  for (const day of groupByDay(txns)) {
    const month = day.dateIso.slice(0, 7)
    let g = months[months.length - 1]
    if (!g || g.month !== month) months.push((g = { month, spend: 0, days: [] }))
    g.days.push(day)
    g.spend += day.spend
  }
  return months
}

/** First day of the month `monthsBack - 1` months before todayIso's month — the start of an N-month window. */
export function windowStart(todayIso: string, monthsBack: number): string {
  const [y, m] = todayIso.split('-').map(Number)
  const t = y * 12 + (m - 1) - (monthsBack - 1)
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}-01`
}
