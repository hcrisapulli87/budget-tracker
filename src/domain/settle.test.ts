import { describe, it, expect } from 'vitest'
import { computeSettlement } from './settle'
import type { Txn } from '../data/types'

const t = (owner_id: string, amount: number, txn_date: string): Txn => ({
  id: Math.random().toString(), owner_id, account: 'x', txn_date, amount,
  description: '', merchant_norm: '', category_id: null, category_confirmed: true,
  import_hash: '', source: 'manual', import_id: null, note: '', deductible: false,
  deduction_category: null,
})

describe('computeSettlement', () => {
  it('is square when both spent equally', () => {
    const r = computeSettlement([t('you', -100, '2026-07-01'), t('sam', -100, '2026-07-02')], 'you', 'sam', null)
    expect(r.owed).toBe(null)
    expect(r.amount).toBe(0)
  })

  it('partner owes you half the gap when you paid more', () => {
    const r = computeSettlement([t('you', -300, '2026-07-01'), t('sam', -100, '2026-07-02')], 'you', 'sam', null)
    expect(r.owed).toBe('you')
    expect(r.amount).toBe(100) // (300-100)/2
  })

  it('you owe partner when they paid more', () => {
    const r = computeSettlement([t('you', -50, '2026-07-01'), t('sam', -250, '2026-07-02')], 'you', 'sam', null)
    expect(r.owed).toBe('partner')
    expect(r.amount).toBe(100)
  })

  it('ignores income (positive amounts)', () => {
    const r = computeSettlement([t('you', 500, '2026-07-01'), t('sam', -100, '2026-07-02')], 'you', 'sam', null)
    expect(r.owed).toBe('partner')
    expect(r.amount).toBe(50)
  })

  it('only counts spend after the last settlement', () => {
    const r = computeSettlement(
      [t('you', -300, '2026-06-01'), t('you', -40, '2026-07-10')],
      'you', 'sam', '2026-07-01',
    )
    expect(r.yourSpend).toBe(40)
    expect(r.owed).toBe('you')
    expect(r.amount).toBe(20)
  })
})
