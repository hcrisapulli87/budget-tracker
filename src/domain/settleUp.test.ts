import { describe, it, expect } from 'vitest'
import { settleUp } from './settleUp'

describe('settleUp', () => {
  const txns = [
    { owner_id: 'a', amount: -120, txn_date: '2026-10-01' },
    { owner_id: 'b', amount: -40, txn_date: '2026-10-02' },
    { owner_id: 'a', amount: 20, txn_date: '2026-10-03' }, // refund on a shared cost
    { owner_id: 'b', amount: -500, txn_date: '2026-09-01' }, // before the last settle-up
  ]
  it('splits shared spend 50/50 since the last settlement', () => {
    const s = settleUp(txns, 'a', 'b', '2026-09-30')
    expect(s.paid.get('a')).toBe(100)
    expect(s.paid.get('b')).toBe(40)
    expect(s.total).toBe(140)
    expect(s.owes).toEqual({ from: 'b', to: 'a', amount: 30 })
  })
  it('is square when both paid the same', () => {
    expect(settleUp([{ owner_id: 'a', amount: -10, txn_date: '2026-10-01' }, { owner_id: 'b', amount: -10, txn_date: '2026-10-01' }], 'a', 'b', null).owes).toBeNull()
  })
})
