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
