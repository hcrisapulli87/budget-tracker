import { supabase } from '../lib/supabase'
import type { Txn } from './types'

/**
 * User corrected a transaction's category. Persist the correction, learn a rule
 * from the merchant, and retro-apply it to that merchant's other unconfirmed
 * transactions. This is the whole "learning" mechanism — no ML.
 */
export async function applyCorrection(txn: Txn, categoryId: string): Promise<void> {
  const { error: txnError } = await supabase
    .from('budget_transactions')
    .update({ category_id: categoryId, category_confirmed: true })
    .eq('id', txn.id)
  if (txnError) throw txnError

  if (!txn.merchant_norm) return

  const { data: existing, error: findError } = await supabase
    .from('budget_rules')
    .select('*')
    .eq('pattern', txn.merchant_norm)
    .maybeSingle()
  if (findError) throw findError

  if (existing) {
    const { error } = await supabase
      .from('budget_rules')
      .update({ category_id: categoryId, hits: (existing.hits as number) + 1, created_from: 'correction' })
      .eq('id', existing.id)
    if (error) throw error
  } else {
    const { error } = await supabase
      .from('budget_rules')
      .insert({ pattern: txn.merchant_norm, category_id: categoryId, created_from: 'correction' })
    if (error) throw error
  }

  const { error: retroError } = await supabase
    .from('budget_transactions')
    .update({ category_id: categoryId })
    .eq('merchant_norm', txn.merchant_norm)
    .eq('category_confirmed', false)
  if (retroError) throw retroError
}

export async function deleteRule(id: string): Promise<void> {
  const { error } = await supabase.from('budget_rules').delete().eq('id', id)
  if (error) throw error
}
