import { supabase } from '../lib/supabase'
import { detectRecurring } from '../domain/recurrence'
import { addDaysIso, isoToday } from '../domain/money'
import type { Subscription, SubStatus } from './types'

export async function fetchSubscriptions(): Promise<Subscription[]> {
  const { data, error } = await supabase
    .from('budget_subscriptions')
    .select('*')
    .order('status', { ascending: true })
    .order('name', { ascending: true })
  if (error) throw error
  return (data ?? []) as Subscription[]
}

export async function setStatus(id: string, status: SubStatus): Promise<void> {
  const { error } = await supabase.from('budget_subscriptions').update({ status }).eq('id', id)
  if (error) throw error
}

export async function renameSubscription(id: string, name: string): Promise<void> {
  const { error } = await supabase.from('budget_subscriptions').update({ name }).eq('id', id)
  if (error) throw error
}

/**
 * Re-run detection over the user's last ~15 months and reconcile:
 * new merchants → candidate rows; known (candidate/confirmed) rows → refresh
 * amount/cadence/next date and append price changes. Dismissed stays dismissed.
 * Returns how many NEW candidates were found.
 */
export async function syncSubscriptions(userId: string): Promise<number> {
  const since = addDaysIso(isoToday(), -456)
  const { data: txns, error } = await supabase
    .from('budget_transactions')
    .select('merchant_norm, txn_date, amount')
    .eq('owner_id', userId)
    .gte('txn_date', since)
  if (error) throw error

  const candidates = detectRecurring(txns ?? [])
  const { data: existingRows, error: exError } = await supabase
    .from('budget_subscriptions')
    .select('*')
    .eq('owner_id', userId)
  if (exError) throw exError
  const existing = (existingRows ?? []) as Subscription[]

  let added = 0
  for (const c of candidates) {
    const row = existing.find((s) => s.merchant_norm === c.merchantNorm)
    if (!row) {
      const { error: insError } = await supabase.from('budget_subscriptions').insert({
        owner_id: userId,
        merchant_norm: c.merchantNorm,
        name: c.merchantNorm,
        cadence: c.cadence,
        amount: c.amount,
        next_expected: c.nextExpected,
        status: 'candidate',
        price_history: [{ date: c.lastDate, amount: c.amount }],
      })
      if (insError) throw insError
      added++
    } else if (row.status === 'candidate' || row.status === 'confirmed') {
      const history = row.price_history ?? []
      const lastAmount = history[history.length - 1]?.amount
      const price_history = lastAmount !== c.amount ? [...history, { date: c.lastDate, amount: c.amount }] : history
      const { error: upError } = await supabase
        .from('budget_subscriptions')
        .update({ amount: c.amount, cadence: c.cadence, next_expected: c.nextExpected, price_history })
        .eq('id', row.id)
      if (upError) throw upError
    }
  }
  return added
}
