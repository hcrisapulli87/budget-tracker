import { supabase } from '../lib/supabase'
import { normaliseMerchant } from '../domain/merchant'
import { matchRule } from '../domain/ruleEngine'
import { effectiveRules } from '../domain/ownership'
import { bulkSetCategory, fetchUnconfirmed } from './transactions'
import type { Rule, Txn } from './types'

/**
 * User corrected one of their own transactions' category. Persist the
 * correction, learn a rule (theirs — it overrides the household default for
 * them only), and retro-apply it to their other unconfirmed transactions at
 * that merchant. This is the whole "learning" mechanism — no ML.
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
    .eq('owner_id', txn.owner_id)
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
      .insert({ owner_id: txn.owner_id, pattern: txn.merchant_norm, category_id: categoryId, created_from: 'correction' })
    if (error) throw error
  }

  const { error: retroError } = await supabase
    .from('budget_transactions')
    .update({ category_id: categoryId })
    .eq('owner_id', txn.owner_id)
    .eq('merchant_norm', txn.merchant_norm)
    .eq('category_confirmed', false)
  if (retroError) throw retroError
}

/**
 * Re-run one person's rules over all their still-unconfirmed transactions.
 * Runs automatically after every correction, so a new rule categorises the
 * whole backlog (substring matches too), not just that exact merchant.
 * Returns how many transactions changed.
 */
export async function reapplyRules(ownerId: string): Promise<number> {
  const { data, error } = await supabase.from('budget_rules').select('*')
  if (error) throw error
  const rules = effectiveRules((data ?? []) as Rule[], ownerId)
  const rows = await fetchUnconfirmed(ownerId)
  const updates = new Map<string, string[]>() // category id → txn ids
  for (const r of rows) {
    const match = matchRule(r.merchant_norm || normaliseMerchant(r.description), rules)
    if (match && match.category_id !== r.category_id) {
      const ids = updates.get(match.category_id) ?? []
      ids.push(r.id)
      updates.set(match.category_id, ids)
    }
  }
  let changed = 0
  for (const [categoryId, ids] of updates) {
    await bulkSetCategory(ids, categoryId)
    changed += ids.length
  }
  return changed
}

export async function deleteRule(id: string): Promise<void> {
  const { error } = await supabase.from('budget_rules').delete().eq('id', id)
  if (error) throw error
}
