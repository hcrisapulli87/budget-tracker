import { describe, expect, it } from 'vitest'
import { buildInsights } from './insights'
import type { Subscription } from '../data/types'

const sub = (over: Partial<Subscription>): Subscription => ({
  id: 'x',
  owner_id: 'u',
  merchant_norm: 'm',
  name: 'Netflix',
  cadence: 'monthly',
  amount: 18.99,
  price_history: [],
  next_expected: '2026-08-01',
  status: 'confirmed',
  ...over,
})

describe('buildInsights', () => {
  it('flags a category spending spike (>25% above 3-month average, ≥$50)', () => {
    const out = buildInsights({
      categoryNames: new Map([['eat', 'Eating Out']]),
      monthlyByCategory: [{ categoryId: 'eat', totals: [200, 210, 190, 320] }],
      subs: [],
      today: '2026-07-13',
    })
    expect(out.some((i) => i.kind === 'category-spike' && i.message.includes('Eating Out'))).toBe(true)
  })
  it('stays quiet for normal variation or tiny amounts', () => {
    const out = buildInsights({
      categoryNames: new Map([['fuel', 'Fuel']]),
      monthlyByCategory: [
        { categoryId: 'fuel', totals: [100, 110, 95, 112] },
        { categoryId: 'small', totals: [10, 10, 10, 20] },
      ],
      subs: [],
      today: '2026-07-13',
    })
    expect(out).toHaveLength(0)
  })
  it('flags subscription price rises', () => {
    const out = buildInsights({
      categoryNames: new Map(),
      monthlyByCategory: [],
      subs: [sub({ price_history: [{ date: '2026-01-01', amount: 15.99 }, { date: '2026-06-01', amount: 18.99 }] })],
      today: '2026-07-13',
    })
    expect(out.some((i) => i.kind === 'price-rise')).toBe(true)
  })
  it('flags possibly unused subscriptions (nothing charged for 2 cycles)', () => {
    const out = buildInsights({
      categoryNames: new Map(),
      monthlyByCategory: [],
      subs: [sub({ next_expected: '2026-05-01' })], // >2 months stale vs today
      today: '2026-07-13',
    })
    expect(out.some((i) => i.kind === 'unused-sub')).toBe(true)
  })
  it('flags streaming overlap at 3+ services', () => {
    const out = buildInsights({
      categoryNames: new Map(),
      monthlyByCategory: [],
      subs: [
        sub({ id: '1', merchant_norm: 'netflix', name: 'Netflix' }),
        sub({ id: '2', merchant_norm: 'stan', name: 'Stan' }),
        sub({ id: '3', merchant_norm: 'disney plus', name: 'Disney+' }),
      ],
      today: '2026-07-13',
    })
    expect(out.some((i) => i.kind === 'streaming-overlap')).toBe(true)
  })
})
