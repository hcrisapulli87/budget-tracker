import { supabase } from '../lib/supabase'
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

export async function fetchTransactions(fromIso: string, toIso: string): Promise<Txn[]> {
  const { data, error } = await supabase
    .from('budget_transactions')
    .select('*')
    .gte('txn_date', fromIso)
    .lte('txn_date', toIso)
    .order('txn_date', { ascending: false })
  if (error) throw error
  return (data ?? []) as Txn[]
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
}

export async function updateTransaction(id: string, patch: TxnPatch): Promise<void> {
  const { error } = await supabase.from('budget_transactions').update(patch).eq('id', id)
  if (error) throw error
}

/** All-time description search (case-insensitive), newest first, capped. */
export async function searchTransactions(term: string): Promise<Txn[]> {
  const { data, error } = await supabase
    .from('budget_transactions')
    .select('*')
    .ilike('description', `%${term}%`)
    .order('txn_date', { ascending: false })
    .limit(200)
  if (error) throw error
  return (data ?? []) as Txn[]
}

/** Every transaction whose category is still a guess (or missing) — re-scan fodder. */
export async function fetchUnconfirmed(): Promise<Pick<Txn, 'id' | 'description' | 'merchant_norm' | 'category_id'>[]> {
  const { data, error } = await supabase
    .from('budget_transactions')
    .select('id, description, merchant_norm, category_id')
    .eq('category_confirmed', false)
  if (error) throw error
  return (data ?? []) as Pick<Txn, 'id' | 'description' | 'merchant_norm' | 'category_id'>[]
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

export async function fetchByMerchant(merchantNorm: string): Promise<Txn[]> {
  const { data, error } = await supabase
    .from('budget_transactions')
    .select('*')
    .eq('merchant_norm', merchantNorm)
    .order('txn_date', { ascending: false })
    .limit(200)
  if (error) throw error
  return (data ?? []) as Txn[]
}
