import { describe, it, expect } from 'vitest'
import { goalStatus } from './goals'
import type { Goal } from '../data/types'

const goal = (over: Partial<Goal>): Goal => ({
  id: 'g', owner_id: null, name: 'Japan', icon: '✈️', target_amount: 6000, target_date: '2027-10-18',
  saved_amount: 0, is_archived: false, created_at: '2025-10-18T00:00:00Z', ...over,
})

describe('goalStatus', () => {
  it('works out the monthly saving needed to land on the date', () => {
    const s = goalStatus(goal({ saved_amount: 3000 }), '2026-10-18')
    expect(s.monthsLeft).toBe(12)
    expect(s.monthlyNeeded).toBe(250)
    expect(s.status).toBe('ontrack') // halfway in time, halfway saved
  })
  it('flags a goal that has fallen behind its straight line', () => {
    expect(goalStatus(goal({ saved_amount: 1000 }), '2026-10-18').status).toBe('behind')
  })
  it('handles done, open-ended and overdue goals', () => {
    expect(goalStatus(goal({ saved_amount: 6000 }), '2026-10-18').status).toBe('done')
    expect(goalStatus(goal({ target_date: null }), '2026-10-18')).toMatchObject({ status: 'open', monthlyNeeded: null })
    expect(goalStatus(goal({ target_date: '2026-01-01' }), '2026-10-18').status).toBe('overdue')
  })
})
