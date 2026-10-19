import { describe, it, expect } from 'vitest'
import { buildAskContext } from './askContext'
import type { Category, Txn } from '../data/types'

const cat = (id: string, name: string, exclude = false): Category => ({ id, name, colour: '', icon: '', sort_order: 0, is_archived: false, exclude_from_analytics: exclude })
const txn = (over: Partial<Txn>): Txn => ({
  id: crypto.randomUUID(), owner_id: 'me', account: 'Everyday 062-000 12345678', txn_date: '2026-10-05', amount: -10,
  description: 'WOOLWORTHS 1234', merchant_norm: 'woolworths', category_id: 'g', category_confirmed: true, import_hash: 'h',
  source: 'csv', import_id: null, note: 'secret note', deductible: false, deduction_category: null, ...over,
})

describe('buildAskContext', () => {
  it('sends aggregates only — no notes, accounts or raw rows', () => {
    const txns = [txn({ amount: -50 }), txn({ amount: -30, txn_date: '2026-09-10' }), txn({ amount: -500, category_id: 'x', merchant_norm: 'transfer', description: 'TRANSFER' })]
    const ctx = buildAskContext({
      today: '2026-10-18', expanded: txns, txns, categories: [cat('g', 'Groceries'), cat('x', 'Transfers', true)],
      budgets: [{ id: 'b', owner_id: 'me', category_id: 'g', monthly_limit: 400 }], goals: [], recurring: [], accounts: [],
      pay: null, safe: null, forecast: null, months: 2,
    })
    expect(ctx.months).toEqual([
      { month: '2026-09', spend: 30, income: 0, byCategory: { Groceries: 30 } },
      { month: '2026-10 (so far)', spend: 50, income: 0, byCategory: { Groceries: 50 } },
    ])
    expect(ctx.budgets).toEqual([{ category: 'Groceries', monthlyLimit: 400, spentThisMonth: 50, rollsOver: false }])
    expect(ctx.topMerchants).toEqual([{ name: 'WOOLWORTHS 1234', total: 80, visits: 2 }])
    const text = JSON.stringify(ctx)
    expect(text).not.toContain('secret note')
    expect(text).not.toContain('12345678')
  })
})
