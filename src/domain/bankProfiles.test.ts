import { describe, expect, it } from 'vitest'
import { BANK_PROFILES, applyProfile, genericProfile, latestBalance } from './bankProfiles'

const commbank = BANK_PROFILES.find((p) => p.id === 'commbank')!
const westpac = BANK_PROFILES.find((p) => p.id === 'westpac')!
const ing = BANK_PROFILES.find((p) => p.id === 'ing')!
const nab = BANK_PROFILES.find((p) => p.id === 'nab')!
const macquarie = BANK_PROFILES.find((p) => p.id === 'macquarie')!

describe('commbank profile (Date, Amount, Description, Balance — no header)', () => {
  it('parses a spend row (with running balance)', () => {
    const out = applyProfile([['23/06/2026', '-12.50', 'WOOLWORTHS SYDNEY', '+1000.00']], commbank)
    expect(out).toEqual([{ dateIso: '2026-06-23', amount: -12.5, description: 'WOOLWORTHS SYDNEY', balance: 1000 }])
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
      { dateIso: '2026-06-23', amount: -18.99, description: 'NETFLIX.COM', balance: 500 },
      { dateIso: '2026-06-25', amount: 2500, description: 'SALARY', balance: 3000 },
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
      { dateIso: '2026-06-23', amount: -54.2, description: 'COLES 0412', balance: 945.8 },
    ])
  })
})

describe('nab profile (Date, Amount, Account, blank, Type, Details, Balance — no header)', () => {
  it('parses signed-amount rows with "15 Jul 25" dates', () => {
    const rows = [
      ['15 Jul 25', '-32.80', '083004123456789', '', 'EFTPOS PURCHASE', 'WOOLWORTHS 1234 MELBOURNE', '+1467.20'],
      ['16 Jul 25', '2500.00', '083004123456789', '', 'TRANSFER CREDIT', 'SALARY ACME PTY LTD', '+3967.20'],
    ]
    expect(applyProfile(rows, nab)).toEqual([
      { dateIso: '2025-07-15', amount: -32.8, description: 'WOOLWORTHS 1234 MELBOURNE', balance: 1467.2 },
      { dateIso: '2025-07-16', amount: 2500, description: 'SALARY ACME PTY LTD', balance: 3967.2 },
    ])
  })
  it('tolerates an accidental header row', () => {
    const rows = [
      ['Date', 'Amount', 'Account Number', '', 'Transaction Type', 'Transaction Details', 'Balance'],
      ['15 Jul 25', '-10.00', '083004123456789', '', 'EFTPOS PURCHASE', 'COLES', '+90.00'],
    ]
    expect(applyProfile(rows, nab)).toHaveLength(1)
  })
})

describe('macquarie profile (header-driven; column set varies between exports)', () => {
  it('parses the real 11-column export (Tags + Notes + Original Description)', () => {
    const rows = [
      ['Transaction Date', 'Details', 'Account', 'Category', 'Subcategory', 'Tags', 'Notes', 'Debit', 'Credit', 'Balance', 'Original Description'],
      ['12 Jul 2026', 'To Harrison Westpac Account - Funds Transfer Receipt number: ON0000216372037 Payment description: Funds transfer', 'Macquarie Savings Account', 'Financial', 'Transfers', '', '', '200', '', '5415.5', 'To Harrison Westpac account - Funds transfer'],
      ['30 Jun 2026', 'Payment', 'Macquarie Savings Account', 'Income', 'Interest', 'tax', '', '', '19.15', '5765.5', 'Payment'],
    ]
    expect(applyProfile(rows, macquarie)).toEqual([
      { dateIso: '2026-07-12', amount: -200, description: 'To Harrison Westpac account - Funds transfer', balance: 5415.5 },
      { dateIso: '2026-06-30', amount: 19.15, description: 'Payment', balance: 5765.5 },
    ])
  })
  it('still parses the older 10-column layout (no Tags, no Original Description)', () => {
    const rows = [
      ['Transaction Date', 'Details', 'Account', 'Category', 'Sub Category', 'Notes', 'Debit', 'Credit', 'Balance', ''],
      ['05 Mar 2023', 'UBER *EATS', 'Transaction', 'Eating out', '', '', '24.90', '', '812.10', ''],
      ['07 Mar 2023', 'SALARY ACME', 'Transaction', 'Income', '', '', '', '2500.00', '3312.10', ''],
    ]
    expect(applyProfile(rows, macquarie)).toEqual([
      { dateIso: '2023-03-05', amount: -24.9, description: 'UBER *EATS', balance: 812.1 },
      { dateIso: '2023-03-07', amount: 2500, description: 'SALARY ACME', balance: 3312.1 },
    ])
  })
})

describe('latestBalance', () => {
  it('returns the balance of the most recent transaction (oldest-first file)', () => {
    const parsed = [
      { dateIso: '2026-07-01', amount: -10, description: 'A', balance: 90 },
      { dateIso: '2026-07-02', amount: -10, description: 'B', balance: 80 },
    ]
    expect(latestBalance(parsed)).toEqual({ balance: 80, dateIso: '2026-07-02' })
  })
  it('handles newest-first files (same-date ties resolved by file order)', () => {
    const parsed = [
      { dateIso: '2026-07-02', amount: -10, description: 'B', balance: 80 },
      { dateIso: '2026-07-02', amount: -5, description: 'C', balance: 85 },
      { dateIso: '2026-07-01', amount: -10, description: 'A', balance: 90 },
    ]
    expect(latestBalance(parsed)).toEqual({ balance: 80, dateIso: '2026-07-02' })
  })
  it('returns null when no rows carry a balance', () => {
    expect(latestBalance([{ dateIso: '2026-07-01', amount: -10, description: 'A' }])).toBeNull()
  })
  it('returns null for empty input', () => {
    expect(latestBalance([])).toBeNull()
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
