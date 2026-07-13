import { describe, expect, it } from 'vitest'
import { advanceDue, suggestMatch } from './billing'

describe('advanceDue', () => {
  it('advances monthly to the same due day', () => {
    expect(advanceDue('2026-07-15', 'monthly', 15)).toBe('2026-08-15')
  })
  it('clamps to short months and recovers', () => {
    expect(advanceDue('2026-01-31', 'monthly', 31)).toBe('2026-02-28')
    expect(advanceDue('2026-02-28', 'monthly', 31)).toBe('2026-03-31')
  })
  it('advances quarterly and annual', () => {
    expect(advanceDue('2026-07-01', 'quarterly', 1)).toBe('2026-10-01')
    expect(advanceDue('2026-07-01', 'annual', 1)).toBe('2027-07-01')
  })
  it('rolls over year end', () => {
    expect(advanceDue('2026-12-15', 'monthly', 15)).toBe('2027-01-15')
  })
})

describe('suggestMatch', () => {
  const bill = { amount: 120, next_due: '2026-07-15' }
  it('finds a txn near the due date with a close amount', () => {
    const match = suggestMatch(bill, [
      { id: 'a', txn_date: '2026-07-14', amount: -119.5, description: 'AGL ENERGY' },
      { id: 'b', txn_date: '2026-07-01', amount: -120, description: 'TOO EARLY' },
    ])
    expect(match?.id).toBe('a')
  })
  it('returns null when nothing is close', () => {
    expect(suggestMatch(bill, [{ id: 'a', txn_date: '2026-07-15', amount: -40, description: 'X' }])).toBeNull()
  })
})
