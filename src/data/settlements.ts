import { supabase } from '../lib/supabase'
import type { Settlement } from './types'

export async function fetchSettlements(): Promise<Settlement[]> {
  const { data, error } = await supabase
    .from('budget_settlements')
    .select('*')
    .order('settled_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as Settlement[]
}

/** ISO date of the most recent settlement, or null if the couple has never settled. */
export async function lastSettledDate(): Promise<string | null> {
  const rows = await fetchSettlements()
  return rows[0]?.settled_at?.slice(0, 10) ?? null
}

export async function recordSettlement(input: {
  from_id: string
  to_id: string
  amount: number
  created_by: string
}): Promise<void> {
  const { error } = await supabase.from('budget_settlements').insert(input)
  if (error) throw error
}
