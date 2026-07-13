import { describe, expect, it } from 'vitest'
import { groupByDay } from './grouping'
import type { Txn } from '../data/types'

function txn(id: string, date: string, amount: number): Txn {
  return {
    id, owner_id: 'u1', account: 'a', txn_date: date, amount, description: id,
    merchant_norm: id, category_id: null, category_confirmed: false,
    import_hash: id, source: 'manual', import_id: null, note: '',
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
