import { supabase } from '../lib/supabase'
import { fetchAllRows } from './paging'
import type { Settlement } from './types'

export async function fetchLatestSettlement(): Promise<Settlement | null> {
  const { data, error } = await supabase.from('budget_settlements').select('*').order('settled_at', { ascending: false }).limit(1)
  if (error) throw error
  return ((data ?? [])[0] as Settlement | undefined) ?? null
}

export async function recordSettlement(fromId: string, toId: string, amount: number, createdBy: string): Promise<void> {
  const { error } = await supabase.from('budget_settlements').insert({
    from_id: fromId, to_id: toId, amount, created_by: createdBy, settled_at: new Date().toISOString(),
  })
  if (error) throw error
}

/** Both people's shared-cost transactions after a date (null = all time). */
export async function fetchSharedTxns(afterIso: string | null): Promise<{ owner_id: string; amount: number; txn_date: string; description: string; id: string }[]> {
  return fetchAllRows((from, to) => {
    let q = supabase.from('budget_transactions').select('id, owner_id, amount, txn_date, description').eq('shared', true)
    if (afterIso) q = q.gt('txn_date', afterIso)
    return q.order('txn_date', { ascending: false }).order('id', { ascending: true }).range(from, to)
  })
}
