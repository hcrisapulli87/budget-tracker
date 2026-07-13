import type { Txn } from '../data/types'

export type Range = 'week' | 'month' | '3m' | 'year'

export interface RangeBounds { from: string; to: string; prevFrom: string; prevTo: string }

function pad(n: number): string { return String(n).padStart(2, '0') }
function iso(y: number, m: number, d: number): string { return `${y}-${pad(m)}-${pad(d)}` }
function lastDay(y: number, m: number): number { return new Date(Date.UTC(y, m, 0)).getUTCDate() }
function shiftDays(isoDate: string, days: number): string {
  return new Date(Date.parse(isoDate) + days * 86_400_000).toISOString().slice(0, 10)
}

/** Current + previous equal-length window for each display range. */
export function rangeBounds(range: Range, todayIso: string): RangeBounds {
  const [y, m] = todayIso.split('-').map(Number)
  if (range === 'week') {
    const dow = new Date(`${todayIso}T00:00:00Z`).getUTCDay() // 0=Sun
    const from = shiftDays(todayIso, -((dow + 6) % 7))
    return { from, to: shiftDays(from, 6), prevFrom: shiftDays(from, -7), prevTo: shiftDays(from, -1) }
  }
  if (range === 'month') {
    const pm = m === 1 ? 12 : m - 1
    const py = m === 1 ? y - 1 : y
    return { from: iso(y, m, 1), to: iso(y, m, lastDay(y, m)), prevFrom: iso(py, pm, 1), prevTo: iso(py, pm, lastDay(py, pm)) }
  }
  if (range === '3m') {
    const start = y * 12 + (m - 1) - 2
    const sY = Math.floor(start / 12); const sM = (start % 12) + 1
    const pEnd = start - 1; const pStart = start - 3
    const peY = Math.floor(pEnd / 12); const peM = (pEnd % 12) + 1
    const psY = Math.floor(pStart / 12); const psM = (pStart % 12) + 1
    return {
      from: iso(sY, sM, 1), to: iso(y, m, lastDay(y, m)),
      prevFrom: iso(psY, psM, 1), prevTo: iso(peY, peM, lastDay(peY, peM)),
    }
  }
  return { from: iso(y, 1, 1), to: iso(y, 12, 31), prevFrom: iso(y - 1, 1, 1), prevTo: iso(y - 1, 12, 31) }
}

function inRange(t: Txn, from: string, to: string): boolean { return t.txn_date >= from && t.txn_date <= to }
function counted(t: Txn, excluded: Set<string>): boolean { return !(t.category_id !== null && excluded.has(t.category_id)) }

export interface CashFlow {
  moneyIn: number
  moneyOut: number
  net: number
  byMonth: { month: string; moneyIn: number; moneyOut: number }[]
}

export function cashFlow(txns: Txn[], from: string, to: string, excluded: Set<string>): CashFlow {
  const rows = txns.filter((t) => inRange(t, from, to) && counted(t, excluded))
  const byMonth = new Map<string, { moneyIn: number; moneyOut: number }>()
  let moneyIn = 0
  let moneyOut = 0
  for (const t of rows) {
    const month = t.txn_date.slice(0, 7)
    const b = byMonth.get(month) ?? { moneyIn: 0, moneyOut: 0 }
    if (t.amount > 0) { moneyIn += t.amount; b.moneyIn += t.amount } else { moneyOut -= t.amount; b.moneyOut -= t.amount }
    byMonth.set(month, b)
  }
  return {
    moneyIn, moneyOut, net: moneyIn - moneyOut,
    byMonth: [...byMonth.entries()].sort().map(([month, b]) => ({ month, ...b })),
  }
}

export interface CategoryDelta { categoryId: string | null; total: number; share: number; delta: number }

export function categoryBreakdownWithDelta(txns: Txn[], bounds: RangeBounds, excluded: Set<string>): CategoryDelta[] {
  const sumBy = (from: string, to: string) => {
    const m = new Map<string | null, number>()
    for (const t of txns) {
      if (t.amount >= 0 || !inRange(t, from, to) || !counted(t, excluded)) continue
      m.set(t.category_id, (m.get(t.category_id) ?? 0) - t.amount)
    }
    return m
  }
  const cur = sumBy(bounds.from, bounds.to)
  const prev = sumBy(bounds.prevFrom, bounds.prevTo)
  const grand = [...cur.values()].reduce((s, v) => s + v, 0)
  return [...cur.entries()]
    .map(([categoryId, total]) => ({
      categoryId, total,
      share: grand === 0 ? 0 : total / grand,
      delta: total - (prev.get(categoryId) ?? 0),
    }))
    .sort((a, b) => b.total - a.total)
}

export interface MerchantStat { merchant: string; label: string; total: number; count: number }

export function merchantLeaderboard(txns: Txn[], from: string, to: string, excluded: Set<string>, limit = 10): MerchantStat[] {
  const groups = new Map<string, Txn[]>()
  for (const t of txns) {
    if (t.amount >= 0 || !inRange(t, from, to) || !counted(t, excluded) || !t.merchant_norm) continue
    groups.set(t.merchant_norm, [...(groups.get(t.merchant_norm) ?? []), t])
  }
  return [...groups.entries()]
    .map(([merchant, rows]) => {
      const latest = rows.reduce((a, b) => (a.txn_date >= b.txn_date ? a : b))
      return { merchant, label: latest.description, total: rows.reduce((s, t) => s - t.amount, 0), count: rows.length }
    })
    .sort((a, b) => b.total - a.total)
    .slice(0, limit)
}

/** Spend totals Monday..Sunday (index 0 = Monday). */
export function dayOfWeekPattern(txns: Txn[], from: string, to: string, excluded: Set<string>): number[] {
  const out = [0, 0, 0, 0, 0, 0, 0]
  for (const t of txns) {
    if (t.amount >= 0 || !inRange(t, from, to) || !counted(t, excluded)) continue
    const dow = new Date(`${t.txn_date}T00:00:00Z`).getUTCDay()
    out[(dow + 6) % 7] -= t.amount
  }
  return out
}

export function averages(txns: Txn[], from: string, to: string, excluded: Set<string>): { perDay: number; perTxn: number; biggest: number } {
  const spends = txns.filter((t) => t.amount < 0 && inRange(t, from, to) && counted(t, excluded))
  const total = spends.reduce((s, t) => s - t.amount, 0)
  const days = Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1
  return {
    perDay: days > 0 ? total / days : 0,
    perTxn: spends.length > 0 ? total / spends.length : 0,
    biggest: spends.reduce((m, t) => Math.max(m, -t.amount), 0),
  }
}
