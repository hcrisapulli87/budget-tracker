import { describe, expect, it } from 'vitest'
import { BANK_PROFILES, applyProfile, genericProfile } from './bankProfiles'

const commbank = BANK_PROFILES.find((p) => p.id === 'commbank')!
const westpac = BANK_PROFILES.find((p) => p.id === 'westpac')!
const ing = BANK_PROFILES.find((p) => p.id === 'ing')!

describe('commbank profile (Date, Amount, Description, Balance — no header)', () => {
  it('parses a spend row', () => {
    const out = applyProfile([['23/06/2026', '-12.50', 'WOOLWORTHS SYDNEY', '+1000.00']], commbank)
    expect(out).toEqual([{ dateIso: '2026-06-23', amount: -12.5, description: 'WOOLWORTHS SYDNEY' }])
  })
  it('drops malformed rows', () => {
    expect(applyProfile([['garbage', 'x']], commbank)).toEqual([])
  })
})

describe('westpac profile (header; Debit/Credit columns)', () => {
  it('skips header, maps debit to negative and credit to positive', () => {
    const rows = [
      ['Bank Account', 'Date', 'Narrative', 'Debit Amount', 'Credit Amount', 'Balance', 'Categories', 'Serial'],
      ['032000123456', '23/06/2026', 'NETFLIX.COM', '18.99', '', '500.00', '', ''],
      ['032000123456', '25/06/2026', 'SALARY', '', '2500.00', '3000.00', '', ''],
    ]
    expect(applyProfile(rows, westpac)).toEqual([
      { dateIso: '2026-06-23', amount: -18.99, description: 'NETFLIX.COM' },
      { dateIso: '2026-06-25', amount: 2500, description: 'SALARY' },
    ])
  })
})

describe('ing profile (header; Date, Description, Credit, Debit, Balance)', () => {
  it('maps debit column to negative', () => {
    const rows = [
      ['Date', 'Description', 'Credit', 'Debit', 'Balance'],
      ['23/06/2026', 'COLES 0412', '', '-54.20', '945.80'],
    ]
    expect(applyProfile(rows, ing)).toEqual([
      { dateIso: '2026-06-23', amount: -54.2, description: 'COLES 0412' },
    ])
  })
})

describe('genericProfile', () => {
  it('maps arbitrary columns with a single amount column', () => {
    const p = genericProfile({ hasHeader: true, dateCol: 0, descCol: 1, amountCol: 2, dateStyle: 'iso' })
    const rows = [
      ['date', 'desc', 'amt'],
      ['2026-06-23', 'THING', '-9.00'],
    ]
    expect(applyProfile(rows, p)).toEqual([{ dateIso: '2026-06-23', amount: -9, description: 'THING' }])
  })
  it('maps split debit/credit columns', () => {
    const p = genericProfile({ hasHeader: false, dateCol: 0, descCol: 1, debitCol: 2, creditCol: 3, dateStyle: 'dmy' })
    expect(applyProfile([['23/06/2026', 'X', '10.00', '']], p)).toEqual([
      { dateIso: '2026-06-23', amount: -10, description: 'X' },
    ])
  })
})
