import { supabase } from '../lib/supabase'
import { fetchAllRows } from './paging'
import type { Txn, TxnSource } from './types'

export interface TxnInsert {
  owner_id: string
  account: string
  txn_date: string
  amount: number
  description: string
  merchant_norm: string
  category_id: string | null
  category_confirmed: boolean
  import_hash: string
  source: TxnSource
  import_id: string | null
  note?: string
}

/**
 * One person's transactions in a date range (everyone's when ownerId is
 * omitted), newest first. Pages through PostgREST's 1000-row cap so long
 * ranges (a year, all of Activity) never come back silently truncated.
 */
export async function fetchTransactions(fromIso: string, toIso: string, ownerId?: string): Promise<Txn[]> {
  return fetchAllRows<Txn>((from, to) => {
    let q = supabase
      .from('budget_transactions')
      .select('*')
      .gte('txn_date', fromIso)
      .lte('txn_date', toIso)
    if (ownerId) q = q.eq('owner_id', ownerId)
    return q
      .order('txn_date', { ascending: false })
      .order('id', { ascending: true }) // stable order across pages
      .range(from, to)
  })
}

/** Date of one person's oldest transaction, or null if they have none. */
export async function fetchOldestDate(ownerId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('budget_transactions')
    .select('txn_date')
    .eq('owner_id', ownerId)
    .order('txn_date', { ascending: true })
    .limit(1)
  if (error) throw error
  return ((data ?? [])[0]?.txn_date as string | undefined) ?? null
}

/** Which of these import keys already exist? (chunked — PostgREST `in` limits) */
export async function existingKeys(keys: string[]): Promise<Set<string>> {
  const found = new Set<string>()
  for (let i = 0; i < keys.length; i += 200) {
    const chunk = keys.slice(i, i + 200)
    const { data, error } = await supabase
      .from('budget_transactions')
      .select('import_hash')
      .in('import_hash', chunk)
    if (error) throw error
    for (const row of data ?? []) found.add(row.import_hash as string)
  }
  return found
}

export async function insertTransactions(rows: TxnInsert[]): Promise<void> {
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await supabase.from('budget_transactions').insert(rows.slice(i, i + 500))
    if (error) throw error
  }
}

export async function deleteTransaction(id: string): Promise<void> {
  const { error } = await supabase.from('budget_transactions').delete().eq('id', id)
  if (error) throw error
}

export interface TxnPatch {
  txn_date?: string
  amount?: number
  description?: string
  merchant_norm?: string
  category_id?: string | null
  category_confirmed?: boolean
  account?: string
  note?: string
  deductible?: boolean
  deduction_category?: string | null
}

export async function updateTransaction(id: string, patch: TxnPatch): Promise<void> {
  const { error } = await supabase.from('budget_transactions').update(patch).eq('id', id)
  if (error) throw error
}

/** All-time description search over one person's transactions, newest first, capped. */
export async function searchTransactions(term: string, ownerId: string): Promise<Txn[]> {
  const { data, error } = await supabase
    .from('budget_transactions')
    .select('*')
    .eq('owner_id', ownerId)
    .ilike('description', `%${term}%`)
    .order('txn_date', { ascending: false })
    .limit(200)
  if (error) throw error
  return (data ?? []) as Txn[]
}

/** Every one of your transactions whose category is still a guess (or missing) — re-scan fodder. */
export async function fetchUnconfirmed(ownerId: string): Promise<Pick<Txn, 'id' | 'description' | 'merchant_norm' | 'category_id'>[]> {
  return fetchAllRows<Pick<Txn, 'id' | 'description' | 'merchant_norm' | 'category_id'>>((from, to) =>
    supabase
      .from('budget_transactions')
      .select('id, description, merchant_norm, category_id')
      .eq('owner_id', ownerId)
      .eq('category_confirmed', false)
      .order('id', { ascending: true })
      .range(from, to),
  )
}

/** Set one category across many rows (chunked — PostgREST `in` limits). */
export async function bulkSetCategory(ids: string[], categoryId: string): Promise<void> {
  for (let i = 0; i < ids.length; i += 200) {
    const { error } = await supabase
      .from('budget_transactions')
      .update({ category_id: categoryId })
      .in('id', ids.slice(i, i + 200))
    if (error) throw error
  }
}

export async function fetchByMerchant(merchantNorm: string, ownerId: string): Promise<Txn[]> {
  const { data, error } = await supabase
    .from('budget_transactions')
    .select('*')
    .eq('owner_id', ownerId)
    .eq('merchant_norm', merchantNorm)
    .order('txn_date', { ascending: false })
    .limit(200)
  if (error) throw error
  return (data ?? []) as Txn[]
}
