import { describe, expect, it } from 'vitest'
import { groupByDay, groupByMonth, windowStart } from './grouping'
import type { Txn } from '../data/types'

function txn(id: string, date: string, amount: number): Txn {
  return {
    id, owner_id: 'u1', account: 'a', txn_date: date, amount, description: id,
    merchant_norm: id, category_id: null, category_confirmed: false,
    import_hash: id, source: 'manual', import_id: null, note: '',
    deductible: false, deduction_category: null,
  }
}

describe('groupByDay', () => {
  it('groups newest-day-first with spend subtotals (income excluded from spend)', () => {
    const out = groupByDay([
      txn('a', '2026-07-12', -10), txn('b', '2026-07-12', -5.5), txn('c', '2026-07-12', 100),
      txn('d', '2026-07-10', -3),
    ])
    expect(out.map((g) => g.dateIso)).toEqual(['2026-07-12', '2026-07-10'])
    expect(out[0].spend).toBeCloseTo(15.5, 2)
    expect(out[0].txns.map((t) => t.id)).toEqual(['a', 'b', 'c'])
    expect(out[1].spend).toBe(3)
  })
  it('returns empty for empty input', () => {
    expect(groupByDay([])).toEqual([])
  })
})

describe('groupByMonth', () => {
  const t = (txn_date: string, amount: number) => ({ id: txn_date + amount, txn_date, amount }) as Txn
  it('sections days under their month, newest first, with month spend', () => {
    const out = groupByMonth([t('2026-10-01', -5), t('2026-09-30', -10), t('2026-09-02', -2), t('2026-09-02', 100)])
    expect(out.map((g) => g.month)).toEqual(['2026-10', '2026-09'])
    expect(out[1].days.map((d) => d.dateIso)).toEqual(['2026-09-30', '2026-09-02'])
    expect(out[1].spend).toBe(12)
  })
})

describe('windowStart', () => {
  it('counts the current month as one', () => {
    expect(windowStart('2026-10-15', 3)).toBe('2026-08-01')
    expect(windowStart('2026-02-10', 3)).toBe('2025-12-01')
    expect(windowStart('2026-10-15', 1)).toBe('2026-10-01')
  })
})
