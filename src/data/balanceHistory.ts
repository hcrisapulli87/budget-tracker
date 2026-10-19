import { supabase } from '../lib/supabase'
import { fetchAllRows } from './paging'
import type { BalancePoint } from './types'

export async function fetchBalanceHistory(sinceIso: string): Promise<BalancePoint[]> {
  return fetchAllRows<BalancePoint>((from, to) =>
    supabase.from('budget_balance_history').select('*').gte('as_of', sinceIso).order('as_of').order('id').range(from, to),
  )
}

/** One point per account per day — a later reading the same day replaces it. Never fails the caller. */
export async function recordBalancePoint(accountId: string, asOfIso: string, balance: number): Promise<void> {
  try {
    await supabase.from('budget_balance_history').upsert({ account_id: accountId, as_of: asOfIso, balance }, { onConflict: 'account_id,as_of' })
  } catch {
    // history is a nice-to-have; a pre-v9 schema simply has no table yet
  }
}
