import { describe, it, expect, vi } from 'vitest'

// Force every data-layer import of ../lib/supabase to resolve to the demo mock.
vi.mock('../lib/supabase', async () => {
  const { mockSupabase } = await import('../lib/demo/mockClient')
  return { supabase: mockSupabase }
})

import { supabase } from '../lib/supabase'
import { fetchAccounts } from '../data/accounts'
import { fetchTransactions, updateTransaction } from '../data/transactions'
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
import { currentFy } from '../domain/fy'

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
        fetchImports(),
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
    })
    expect((await fetchBills()).length).toBe(before + 1)
  })
})
