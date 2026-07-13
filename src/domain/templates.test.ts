import { describe, expect, it } from 'vitest'
import { deriveTemplates } from './templates'
import type { Txn } from '../data/types'

let seq = 0
function txn(over: Partial<Txn>): Txn {
  seq += 1
  return {
    id: `t${seq}`, owner_id: 'u1', account: 'cash', txn_date: '2026-07-10', amount: -5,
    description: 'Coffee', merchant_norm: 'coffee', category_id: 'c2', category_confirmed: true,
    import_hash: `m${seq}`, source: 'manual', import_id: null, note: '', ...over,
  }
}

describe('deriveTemplates', () => {
  it('needs ≥2 occurrences of (description, category)', () => {
    const out = deriveTemplates([txn({}), txn({}), txn({ description: 'Lunch' })], '2026-07-13')
    expect(out).toHaveLength(1)
    expect(out[0].description).toBe('Coffee')
    expect(out[0].count).toBe(2)
  })
  it('uses the modal amount, most recent on ties', () => {
    const out = deriveTemplates([
      txn({ amount: -5, txn_date: '2026-07-01' }),
      txn({ amount: -6, txn_date: '2026-07-02' }),
      txn({ amount: -6, txn_date: '2026-07-03' }),
    ], '2026-07-13')
    expect(out[0].amount).toBe(6)
  })
  it('ignores CSV rows, income, and entries older than 90 days', () => {
    const out = deriveTemplates([
      txn({ source: 'csv' }), txn({ source: 'csv' }),
      txn({ amount: 100 }), txn({ amount: 100 }),
      txn({ txn_date: '2026-01-01' }), txn({ txn_date: '2026-01-02' }),
    ], '2026-07-13')
    expect(out).toHaveLength(0)
  })
  it('groups case-insensitively, ranks by count, caps at limit', () => {
    const rows = [
      txn({ description: 'coffee' }), txn({ description: 'COFFEE' }), txn({ description: 'Coffee' }),
      txn({ description: 'Lunch', category_id: 'c3' }), txn({ description: 'Lunch', category_id: 'c3' }),
    ]
    const out = deriveTemplates(rows, '2026-07-13', 1)
    expect(out).toHaveLength(1)
    expect(out[0].count).toBe(3)
  })
  it('takes account from the most recent occurrence', () => {
    const out = deriveTemplates([
      txn({ account: 'old', txn_date: '2026-07-01' }),
      txn({ account: 'new', txn_date: '2026-07-05' }),
    ], '2026-07-13')
    expect(out[0].account).toBe('new')
  })
})
