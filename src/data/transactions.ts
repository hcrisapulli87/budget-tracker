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
