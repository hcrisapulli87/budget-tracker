import { describe, it, expect } from 'vitest'
import { sinkingFunds } from './sinkingFunds'
import { buildRecurring } from './recurring'
import type { Bill } from '../data/types'

const bill = (over: Partial<Bill>): Bill => ({
  id: 'b', owner_id: null, name: 'Bill', amount: 120, is_estimate: false, frequency: 'monthly',
  due_day: 1, next_due: '2026-12-01', autopay: false, category_id: null, last_paid: null, ...over,
})

describe('sinkingFunds', () => {
  it('only covers quarterly and annual items, as a monthly set-aside', () => {
    const items = buildRecurring([
      bill({ id: 'rent', name: 'Rent', frequency: 'monthly' }),
      bill({ id: 'rego', name: 'Rego', frequency: 'annual', amount: 900, next_due: '2027-04-18' }),
    ], [])
    const funds = sinkingFunds(items, '2026-10-18')
    expect(funds.map((f) => f.name)).toEqual(['Rego'])
    expect(funds[0].monthly).toBe(75)
    // 182 of 365 days left → ~50% through the cycle
    expect(funds[0].progress).toBeCloseTo(0.501, 2)
    expect(funds[0].shouldHave).toBeCloseTo(451.23, 0)
  })
})
