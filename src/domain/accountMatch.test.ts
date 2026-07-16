import { describe, expect, it } from 'vitest'
import { digitsOf, formatBsb, groupByAccountRef, matchAccountByRef } from './accountMatch'
import type { Account } from '../data/types'

function account(over: Partial<Account>): Account {
  return {
    id: 'id',
    name: 'Everyday',
    owner_id: null,
    balance: null,
    balance_as_of: null,
    sort_order: 0,
    is_archived: false,
    goal_amount: null,
    bsb: null,
    account_number: null,
    ...over,
  }
}

describe('digitsOf', () => {
  it('strips formatting', () => {
    expect(digitsOf('062-692')).toBe('062692')
    expect(digitsOf('1234 5678')).toBe('12345678')
    expect(digitsOf(null)).toBe('')
  })
})

describe('groupByAccountRef', () => {
  it('splits rows by their account identifier, unmarked rows under ""', () => {
    const rows = [
      { dateIso: '2026-07-01', amount: -1, description: 'A', accountRef: '06269211112222' },
      { dateIso: '2026-07-02', amount: -2, description: 'B', accountRef: '06269233334444' },
      { dateIso: '2026-07-03', amount: -3, description: 'C', accountRef: '06269211112222' },
      { dateIso: '2026-07-04', amount: -4, description: 'D' },
    ]
    const groups = groupByAccountRef(rows)
    expect([...groups.keys()].sort()).toEqual(['', '06269211112222', '06269233334444'])
    expect(groups.get('06269211112222')).toHaveLength(2)
    expect(groups.get('')).toHaveLength(1)
  })
})

describe('matchAccountByRef', () => {
  const everyday = account({ id: 'e', name: 'Everyday', bsb: '062-692', account_number: '11112222' })
  const savings = account({ id: 's', name: 'Savings', bsb: '062692', account_number: '33334444' })

  it('matches BSB + number concatenated', () => {
    expect(matchAccountByRef('06269211112222', [everyday, savings])?.name).toBe('Everyday')
    expect(matchAccountByRef('06269233334444', [everyday, savings])?.name).toBe('Savings')
  })
  it('matches account number alone', () => {
    expect(matchAccountByRef('33334444', [everyday, savings])?.name).toBe('Savings')
  })
  it('matches with zero-padding between BSB and number', () => {
    expect(matchAccountByRef('062692011112222', [everyday, savings])?.name).toBe('Everyday')
  })
  it('returns undefined for unknown refs, empty refs, archived and number-less accounts', () => {
    expect(matchAccountByRef('99999999', [everyday, savings])).toBeUndefined()
    expect(matchAccountByRef('', [everyday, savings])).toBeUndefined()
    expect(matchAccountByRef('11112222', [account({ ...everyday, is_archived: true })])).toBeUndefined()
    expect(matchAccountByRef('11112222', [account({ name: 'NoNumber' })])).toBeUndefined()
  })
})

describe('formatBsb', () => {
  it('formats 6 digits as xxx-xxx', () => {
    expect(formatBsb('062692')).toBe('062-692')
  })
  it('leaves other lengths as digits', () => {
    expect(formatBsb('06269')).toBe('06269')
    expect(formatBsb(null)).toBe('')
  })
})
