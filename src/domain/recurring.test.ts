import { describe, it, expect } from 'vitest'
import { buildRecurring, countdown, dueBetween } from './recurring'
import type { Bill, Subscription } from '../data/types'

const bill = (name: string, amount: number, next_due: string, owner_id: string | null = 'me'): Bill => ({
  id: name, owner_id, name, amount, is_estimate: false, frequency: 'quarterly', due_day: 1,
  next_due, autopay: false, category_id: null, last_paid: null,
})
const sub = (name: string, amount: number, next: string | null, status: Subscription['status'] = 'confirmed'): Subscription => ({
  id: name, owner_id: 'me', merchant_norm: name, name, cadence: 'monthly', amount,
  price_history: [], next_expected: next, status,
})

describe('buildRecurring', () => {
  const items = buildRecurring(
    [bill('Power', 300, '2026-10-20', null), bill('Rego', 800, '2026-10-05')],
    [sub('Netflix', 20, '2026-10-10'), sub('Maybe', 9, '2026-10-01', 'candidate'), sub('Gym', 50, null)],
  )

  it('merges bills and confirmed subscriptions, soonest first', () => {
    expect(items.map((i) => i.name)).toEqual(['Rego', 'Netflix', 'Power', 'Gym'])
  })

  it('leaves unconfirmed candidates out', () => {
    expect(items.some((i) => i.name === 'Maybe')).toBe(false)
  })

  it('normalises to a monthly figure and flags joint bills', () => {
    const power = items.find((i) => i.name === 'Power')!
    expect(power.monthly).toBe(100) // quarterly 300
    expect(power.joint).toBe(true)
  })

  it('finds what is due in a window', () => {
    expect(dueBetween(items, '2026-10-01', '2026-10-12').map((i) => i.name)).toEqual(['Rego', 'Netflix'])
  })
})

describe('countdown', () => {
  it('reads naturally', () => {
    expect(countdown('2026-10-01', '2026-10-01')).toBe('due today')
    expect(countdown('2026-10-02', '2026-10-01')).toBe('tomorrow')
    expect(countdown('2026-10-05', '2026-10-01')).toBe('in 4d')
    expect(countdown('2026-09-29', '2026-10-01')).toBe('2d overdue')
  })
})
