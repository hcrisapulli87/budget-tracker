import { describe, expect, it } from 'vitest'
import {
  rangeBounds, cashFlow, categoryBreakdownWithDelta, merchantLeaderboard,
  dayOfWeekPattern, averages,
} from './stats'
import type { Txn } from '../data/types'

let seq = 0
function txn(over: Partial<Txn>): Txn {
  seq += 1
  return {
    id: `t${seq}`, owner_id: 'u1', account: 'a', txn_date: '2026-07-10', amount: -10,
    description: 'X', merchant_norm: 'x', category_id: 'c1', category_confirmed: false,
    import_hash: `h${seq}`, source: 'csv', import_id: null, note: '',
    deductible: false, deduction_category: null, ...over,
  }
}
const NONE = new Set<string>()

describe('rangeBounds', () => {
  it('week = Mon–Sun containing today (2026-07-13 is a Monday)', () => {
    expect(rangeBounds('week', '2026-07-13')).toEqual({
      from: '2026-07-13', to: '2026-07-19', prevFrom: '2026-07-06', prevTo: '2026-07-12',
    })
  })
  it('month = calendar month, prev = previous month', () => {
    expect(rangeBounds('month', '2026-07-13')).toEqual({
      from: '2026-07-01', to: '2026-07-31', prevFrom: '2026-06-01', prevTo: '2026-06-30',
    })
  })
  it('3m spans current + 2 prior calendar months', () => {
    expect(rangeBounds('3m', '2026-07-13')).toEqual({
      from: '2026-05-01', to: '2026-07-31', prevFrom: '2026-02-01', prevTo: '2026-04-30',
    })
  })
  it('year = calendar year', () => {
    expect(rangeBounds('year', '2026-07-13')).toEqual({
      from: '2026-01-01', to: '2026-12-31', prevFrom: '2025-01-01', prevTo: '2025-12-31',
    })
  })
})

describe('cashFlow', () => {
  const rows = [
    txn({ amount: 2000, txn_date: '2026-06-15' }),
    txn({ amount: -500, txn_date: '2026-06-20' }),
    txn({ amount: -100, txn_date: '2026-07-02' }),
    txn({ amount: -50, txn_date: '2026-07-02', category_id: 'transfers' }),
  ]
  it('sums in/out/net and splits by month, respecting exclusions', () => {
    const cf = cashFlow(rows, '2026-06-01', '2026-07-31', new Set(['transfers']))
    expect(cf.moneyIn).toBe(2000)
    expect(cf.moneyOut).toBe(600)
    expect(cf.net).toBe(1400)
    expect(cf.byMonth).toEqual([
      { month: '2026-06', moneyIn: 2000, moneyOut: 500 },
      { month: '2026-07', moneyIn: 0, moneyOut: 100 },
    ])
  })
})

describe('categoryBreakdownWithDelta', () => {
  it('computes share of spend and delta vs previous period', () => {
    const rows = [
      txn({ amount: -80, category_id: 'c1', txn_date: '2026-07-05' }),
      txn({ amount: -20, category_id: 'c2', txn_date: '2026-07-06' }),
      txn({ amount: -50, category_id: 'c1', txn_date: '2026-06-05' }),
    ]
    const out = categoryBreakdownWithDelta(rows, rangeBounds('month', '2026-07-13'), NONE)
    expect(out[0]).toEqual({ categoryId: 'c1', total: 80, share: 0.8, delta: 30 })
    expect(out[1]).toEqual({ categoryId: 'c2', total: 20, share: 0.2, delta: 20 })
  })
})

describe('merchantLeaderboard', () => {
  it('ranks by total spend with visit counts, labelled by latest description', () => {
    const rows = [
      txn({ merchant_norm: 'woolworths', description: 'WOOLWORTHS 1', amount: -50, txn_date: '2026-07-01' }),
      txn({ merchant_norm: 'woolworths', description: 'WOOLWORTHS 2', amount: -60, txn_date: '2026-07-05' }),
      txn({ merchant_norm: 'bp', description: 'BP', amount: -40 }),
      txn({ merchant_norm: 'pay', description: 'SALARY', amount: 500 }),
    ]
    const out = merchantLeaderboard(rows, '2026-07-01', '2026-07-31', NONE, 10)
    expect(out[0]).toEqual({ merchant: 'woolworths', label: 'WOOLWORTHS 2', total: 110, count: 2 })
    expect(out[1].merchant).toBe('bp')
    expect(out).toHaveLength(2)
  })
})

describe('dayOfWeekPattern', () => {
  it('totals spend Mon..Sun', () => {
    const rows = [
      txn({ txn_date: '2026-07-13', amount: -10 }), // Monday
      txn({ txn_date: '2026-07-18', amount: -7 }),  // Saturday
      txn({ txn_date: '2026-07-11', amount: -3 }),  // Saturday (prev week)
    ]
    const out = dayOfWeekPattern(rows, '2026-07-01', '2026-07-31', NONE)
    expect(out[0]).toBe(10)
    expect(out[5]).toBe(10)
    expect(out[6]).toBe(0)
  })
})

describe('averages', () => {
  it('per-day over the range, per spend txn, biggest single', () => {
    const rows = [
      txn({ amount: -30, txn_date: '2026-07-01' }),
      txn({ amount: -10, txn_date: '2026-07-02' }),
      txn({ amount: 500, txn_date: '2026-07-02' }),
    ]
    const out = averages(rows, '2026-07-01', '2026-07-04', NONE)
    expect(out.perDay).toBe(10)      // 40 / 4 days
    expect(out.perTxn).toBe(20)      // 40 / 2 spends
    expect(out.biggest).toBe(30)
  })
})
