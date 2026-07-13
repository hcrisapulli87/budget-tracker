import { describe, expect, it } from 'vitest'
import { budgetPace } from './budgetMath'

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
