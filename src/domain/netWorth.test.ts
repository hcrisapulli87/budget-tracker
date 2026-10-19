import { describe, it, expect } from 'vitest'
import { groupNetWorth, isSpendable, netWorthHistory, signedBalance } from './netWorth'
import type { Account } from '../data/types'

const acct = (over: Partial<Account>): Account => ({
  id: 'a', name: 'A', owner_id: 'me', balance: 0, balance_as_of: null, sort_order: 0, is_archived: false,
  goal_amount: null, bsb: null, account_number: null, kind: 'bank', ...over,
})

describe('net worth', () => {
  it('counts debts as negative however they were typed', () => {
    expect(signedBalance(acct({ kind: 'credit', balance: 1200 }))).toBe(-1200)
    expect(signedBalance(acct({ kind: 'loan', balance: -300000 }))).toBe(-300000)
    expect(signedBalance(acct({ kind: undefined, balance: 50 }))).toBe(50)
  })
  it('groups by kind into assets, liabilities and net', () => {
    const r = groupNetWorth([
      acct({ id: '1', kind: 'bank', balance: 2000 }),
      acct({ id: '2', kind: 'super', balance: 80000 }),
      acct({ id: '3', kind: 'credit', balance: 1500 }),
      acct({ id: '4', kind: 'savings', balance: 9999, is_archived: true }),
    ])
    expect(r).toMatchObject({ assets: 82000, liabilities: 1500, net: 80500 })
    expect(r.groups.map((g) => g.kind)).toEqual(['bank', 'super', 'credit'])
  })
  it('only spends from everyday and credit accounts', () => {
    expect(isSpendable(acct({ kind: 'bank' }))).toBe(true)
    expect(isSpendable(acct({ kind: 'credit' }))).toBe(true)
    expect(isSpendable(acct({ kind: 'savings' }))).toBe(false)
  })
  it('carries each balance forward to month-ends', () => {
    const accounts = [acct({ id: 'x' }), acct({ id: 'y', kind: 'credit' })]
    const history = [
      { id: '1', account_id: 'x', as_of: '2026-08-10', balance: 1000 },
      { id: '2', account_id: 'x', as_of: '2026-09-20', balance: 1500 },
      { id: '3', account_id: 'y', as_of: '2026-09-05', balance: 200 },
    ]
    expect(netWorthHistory(accounts, history, ['2026-07-31', '2026-08-31', '2026-09-30'])).toEqual([
      { date: '2026-07-31', net: 0 },
      { date: '2026-08-31', net: 1000 },
      { date: '2026-09-30', net: 1300 },
    ])
  })
})
