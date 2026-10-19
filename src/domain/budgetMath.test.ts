import { describe, expect, it } from 'vitest'
import { budgetPace, rolloverCarry, shiftMonth } from './budgetMath'

describe('budgetPace', () => {
  it('on-track when spend ≤ 110% of time-proportional expectation', () => {
    const p = budgetPace(200, 600, 13, 31) // expected ≈ 251.61
    expect(p.expected).toBeCloseTo(251.61, 2)
    expect(p.status).toBe('ontrack')
  })
  it('hot when ahead of pace by >10%', () => {
    expect(budgetPace(300, 600, 13, 31).status).toBe('hot')
  })
  it('over when the limit is blown regardless of date', () => {
    expect(budgetPace(601, 600, 1, 31).status).toBe('over')
  })
})

describe('rolloverCarry', () => {
  it('adds unspent and subtracts overspent full months before this one', () => {
    const spent = new Map([['2026-07', 250], ['2026-08', 350]])
    // Jul +50, Aug -50, Sep (no spend) +300; Oct is the current month
    expect(rolloverCarry(300, spent, '2026-07', '2026-10')).toBe(300)
  })
  it('is zero when rollover starts this month', () => {
    expect(rolloverCarry(300, new Map(), '2026-10', '2026-10')).toBe(0)
  })
  it('crosses year boundaries', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01')
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
    expect(rolloverCarry(100, new Map([['2026-12', 80]]), '2026-11', '2027-01')).toBe(120)
  })
})
