import { describe, it, expect, vi } from 'vitest'

// Force every data-layer import of ../lib/supabase to resolve to the demo mock.
vi.mock('../lib/supabase', async () => {
  const { mockSupabase } = await import('../lib/demo/mockClient')
  return { supabase: mockSupabase }
})

import { supabase } from '../lib/supabase'
import { fetchAccounts } from '../data/accounts'
import { fetchTransactions, fetchUnconfirmed, updateTransaction } from '../data/transactions'
import { fetchBills, addBill } from '../data/bills'
import { fetchSubscriptions } from '../data/subscriptions'
import { fetchBudgets } from '../data/budgets'
import { fetchCategories } from '../data/categories'
import { fetchProfiles } from '../data/profiles'
import { fetchImports } from '../data/imports'
import { fetchIncome } from '../data/taxIncome'
import { fetchManualDeductions } from '../data/taxDeductions'
import { listDocuments } from '../data/taxDocuments'
import { fetchChecklist } from '../data/taxChecklistState'
import { reapplyRules } from '../data/rules'
import { currentFy } from '../domain/fy'
import { ME_ID, PARTNER_ID } from '../lib/demo/mockData'

describe('demo mock backend', () => {
  it('is always signed in (no login)', async () => {
    const { data } = await supabase.auth.getSession()
    expect(data.session).toBeTruthy()
    expect(data.session!.user.id).toBeTruthy()
  })

  it('fills every section with data', async () => {
    const fy = currentFy()
    const [accts, bills, subs, budgets, cats, profiles, imports, income, deds, docs, checklist] =
      await Promise.all([
        fetchAccounts(),
        fetchBills(),
        fetchSubscriptions(),
        fetchBudgets(),
        fetchCategories(),
        fetchProfiles(),
        fetchImports(ME_ID),
        fetchIncome(fy),
        fetchManualDeductions(fy),
        listDocuments(fy),
        fetchChecklist(fy),
      ])
    expect(accts.length).toBeGreaterThan(0)
    expect(bills.length).toBeGreaterThan(0)
    expect(subs.length).toBeGreaterThan(0)
    expect(budgets.length).toBeGreaterThan(0)
    expect(cats.length).toBeGreaterThan(10)
    expect(profiles.length).toBe(2)
    expect(imports.length).toBeGreaterThan(0)
    expect(income.length).toBeGreaterThan(0)
    expect(deds.length).toBeGreaterThan(0)
    expect(docs.length).toBeGreaterThan(0)
    expect(checklist.length).toBeGreaterThan(0)
  })

  it('returns recent transactions in date range, newest first', async () => {
    const today = new Date().toISOString().slice(0, 10)
    const from = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10)
    const txns = await fetchTransactions(from, today)
    expect(txns.length).toBeGreaterThan(0)
    for (const t of txns) expect(t.txn_date >= from && t.txn_date <= today).toBe(true)
    expect(txns[0].txn_date >= txns[txns.length - 1].txn_date).toBe(true)
  })

  it('supports edits (update + insert) against the store', async () => {
    const today = new Date().toISOString().slice(0, 10)
    const from = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
    const txns = await fetchTransactions(from, today)
    await updateTransaction(txns[0].id, { note: 'edited in demo' })
    const after = await fetchTransactions(from, today)
    expect(after.find((t) => t.id === txns[0].id)?.note).toBe('edited in demo')

    const before = (await fetchBills()).length
    await addBill({
      name: 'Gym',
      amount: 60,
      is_estimate: false,
      frequency: 'monthly',
      due_day: 5,
      next_due: today,
      autopay: true,
      category_id: null,
      owner_id: ME_ID,
    })
    expect((await fetchBills()).length).toBe(before + 1)
  })

  it('scopes each view to one person', async () => {
    const today = new Date().toISOString().slice(0, 10)
    const from = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10)
    const mine = await fetchTransactions(from, today, ME_ID)
    expect(mine.length).toBeGreaterThan(0)
    expect(mine.every((t) => t.owner_id === ME_ID)).toBe(true)
    const all = await fetchTransactions(from, today)
    expect(all.length).toBeGreaterThan(mine.length)
  })

  it('re-applies only my rules, only to my unconfirmed transactions', async () => {
    const all = await fetchTransactions('0000-01-01', '9999-12-31')
    const mineTxn = all.find((t) => t.owner_id === ME_ID && t.merchant_norm)!
    // the partner shops at the same merchant, with a guess still unconfirmed
    const { id: _id, ...copy } = mineTxn
    await supabase.from('budget_transactions').insert({ ...copy, owner_id: PARTNER_ID, import_hash: 'partner-same-merchant' })
    const theirs = (await fetchTransactions('0000-01-01', '9999-12-31', PARTNER_ID))
      .filter((t) => t.merchant_norm === mineTxn.merchant_norm)
    expect(theirs.length).toBeGreaterThan(0)
    const cats = await fetchCategories()
    const target = cats.find((c) => c.name === 'Gifts')!
    await updateTransaction(mineTxn.id, { category_confirmed: false, category_id: null })
    for (const t of theirs) await updateTransaction(t.id, { category_confirmed: false, category_id: null })
    await supabase.from('budget_rules').insert({ owner_id: ME_ID, pattern: mineTxn.merchant_norm, category_id: target.id, hits: 0, created_from: 'correction' })

    expect(await reapplyRules(ME_ID)).toBeGreaterThan(0)
    const after = await fetchTransactions('0000-01-01', '9999-12-31')
    expect(after.find((t) => t.id === mineTxn.id)?.category_id).toBe(target.id)
    for (const t of theirs) expect(after.find((x) => x.id === t.id)?.category_id).toBeNull()
  })

  it('lists only Tally members when budget_members is set', async () => {
    expect((await fetchProfiles()).length).toBe(2) // no members table → everyone
    await supabase.from('budget_members').insert({ profile_id: ME_ID })
    expect((await fetchProfiles()).map((p) => p.id)).toEqual([ME_ID])
    await supabase.from('budget_members').delete().eq('profile_id', ME_ID)
  })

  it('pages past the 1000-row cap instead of truncating', async () => {
    const owner = 'paging-owner'
    const rows = Array.from({ length: 1050 }, (_, i) => ({
      owner_id: owner, account: 'x', txn_date: `2020-01-${String((i % 28) + 1).padStart(2, '0')}`,
      amount: -1, description: 'x', merchant_norm: 'x', category_id: null, category_confirmed: true,
      import_hash: `paging-${i}`, source: 'csv', import_id: null,
    }))
    await supabase.from('budget_transactions').insert(rows)
    const got = await fetchTransactions('2020-01-01', '2020-12-31', owner)
    expect(got).toHaveLength(1050)
    expect(new Set(got.map((t) => t.id)).size).toBe(1050)

    // re-categorising sees the whole unconfirmed backlog too
    await Promise.all(got.map((t) => updateTransaction(t.id, { category_confirmed: false })))
    expect(await fetchUnconfirmed(owner)).toHaveLength(1050)
  })
})
