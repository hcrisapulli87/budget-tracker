import { describe, expect, it } from 'vitest'
import { normaliseCadence, PER_YEAR } from './cadence'

describe('normaliseCadence', () => {
  it('monthly 18.99 → 227.88/yr, 4.38/wk', () => {
    const n = normaliseCadence(18.99, 'monthly')
    expect(n.yearly).toBeCloseTo(227.88, 2)
    expect(n.monthly).toBeCloseTo(18.99, 2)
    expect(n.weekly).toBeCloseTo(4.38, 2)
  })
  it('weekly 10 → 520/yr, 43.33/mo', () => {
    const n = normaliseCadence(10, 'weekly')
    expect(n.yearly).toBe(520)
    expect(n.monthly).toBeCloseTo(43.33, 2)
    expect(n.weekly).toBe(10)
  })
  it('annual 120 → 10/mo, 2.31/wk', () => {
    const n = normaliseCadence(120, 'annual')
    expect(n.monthly).toBe(10)
    expect(n.weekly).toBeCloseTo(2.31, 2)
  })
  it('covers every cadence factor', () => {
    expect(PER_YEAR).toEqual({ weekly: 52, fortnightly: 26, monthly: 12, quarterly: 4, annual: 1 })
  })
})
