import { describe, expect, it } from 'vitest'
import { summarise } from './analytics'

const t = (txn_date: string, amount: number, category_id: string | null = null, owner_id = 'u1') => ({
  txn_date,
  amount,
  category_id,
  owner_id,
})

describe('summarise', () => {
  const txns = [
    t('2026-07-01', -50, 'groceries'),
    t('2026-07-01', -10, 'fuel'),
    t('2026-07-03', -25, 'groceries'),
    t('2026-07-02', 3000, 'income'),
    t('2026-06-30', -99, 'groceries'), // outside range
  ]
  const s = summarise(txns, '2026-07-01', '2026-07-03')

  it('totals spend and income within range', () => {
    expect(s.spend).toBe(85)
    expect(s.income).toBe(3000)
  })
  it('ranks categories by spend', () => {
    expect(s.byCategory).toEqual([
      { categoryId: 'groceries', total: 75 },
      { categoryId: 'fuel', total: 10 },
    ])
  })
  it('zero-fills days for the sparkline', () => {
    expect(s.byDay).toEqual([
      { date: '2026-07-01', spend: 60 },
      { date: '2026-07-02', spend: 0 },
      { date: '2026-07-03', spend: 25 },
    ])
  })
})
