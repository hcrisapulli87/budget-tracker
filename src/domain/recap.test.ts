import { describe, it, expect } from 'vitest'
import { buildRecap } from './recap'

const t = (txn_date: string, amount: number, category_id: string | null, description = 'x') => ({ txn_date, amount, category_id, owner_id: 'me', description })

describe('buildRecap', () => {
  it('summarises a month against the one before', () => {
    const r = buildRecap([
      t('2026-09-03', -100, 'food'),
      t('2026-09-10', -50, 'fun'),
      t('2026-10-02', -180, 'food'),
      t('2026-10-05', -400, 'travel', 'QANTAS'),
      t('2026-10-06', -999, 'xfer'),
      t('2026-10-15', 3000, 'income'),
    ], '2026-10', new Set(['xfer']))
    expect(r).toMatchObject({ spend: 580, income: 3000, net: 2420, spendDelta: 430 })
    expect(r.topCategories.map((c) => c.categoryId)).toEqual(['travel', 'food'])
    expect(r.movers.map((c) => [c.categoryId, c.delta])).toEqual([['travel', 400], ['food', 80], ['fun', -50]])
    expect(r.biggest).toEqual({ description: 'QANTAS', amount: -400, date: '2026-10-05' })
  })
})
