import { supabase } from '../lib/supabase'
import type { Account } from './types'

export async function fetchAccounts(): Promise<Account[]> {
  const { data, error } = await supabase
    .from('budget_accounts')
    .select('*')
    .order('sort_order')
    .order('name')
  if (error) throw error
  return (data ?? []) as Account[]
}

export async function createAccount(
  name: string,
  ownerId: string,
  balance: number | null = null,
  asOfIso: string | null = null,
  goal: number | null = null,
  bsb: string | null = null,
  accountNumber: string | null = null,
): Promise<void> {
  const { error } = await supabase
    .from('budget_accounts')
    .insert({
      name: name.trim(),
      owner_id: ownerId,
      balance,
      balance_as_of: balance === null ? null : asOfIso,
      goal_amount: goal,
      bsb,
      account_number: accountNumber,
    })
  if (error) throw error
}

export interface AccountPatch {
  name?: string
  balance?: number | null
  balance_as_of?: string | null
  is_archived?: boolean
  goal_amount?: number | null
  bsb?: string | null
  account_number?: string | null
}

export async function updateAccount(id: string, patch: AccountPatch): Promise<void> {
  const { error } = await supabase.from('budget_accounts').update(patch).eq('id', id)
  if (error) throw error
}

/**
 * Import-time balance capture: create the account if it's new, otherwise move
 * its balance forward — never backwards, so importing an old statement can't
 * clobber a fresher figure.
 */
export async function recordBalance(name: string, ownerId: string, balance: number, asOfIso: string): Promise<void> {
  const trimmed = name.trim()
  const { data, error } = await supabase
    .from('budget_accounts')
    .select('id, balance_as_of')
    .eq('name', trimmed)
    .maybeSingle()
  if (error) throw error
  if (!data) {
    const { error: insErr } = await supabase
      .from('budget_accounts')
      .insert({ name: trimmed, owner_id: ownerId, balance, balance_as_of: asOfIso })
    if (insErr) throw insErr
  } else if (!data.balance_as_of || asOfIso >= data.balance_as_of) {
    await updateAccount(data.id as string, { balance, balance_as_of: asOfIso })
  }
}
