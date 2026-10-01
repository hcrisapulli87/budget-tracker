import { supabase } from '../lib/supabase'
import type { Budget } from './types'

/** Everyone's budgets — DataProvider narrows to the viewed person. */
export async function fetchBudgets(): Promise<Budget[]> {
  const { data, error } = await supabase.from('budget_budgets').select('*')
  if (error) throw error
  return (data ?? []) as Budget[]
}

export async function setBudget(ownerId: string, categoryId: string, monthlyLimit: number): Promise<void> {
  const { error } = await supabase
    .from('budget_budgets')
    .upsert({ owner_id: ownerId, category_id: categoryId, monthly_limit: monthlyLimit }, { onConflict: 'owner_id,category_id' })
  if (error) throw error
}

export async function clearBudget(ownerId: string, categoryId: string): Promise<void> {
  const { error } = await supabase.from('budget_budgets').delete().eq('owner_id', ownerId).eq('category_id', categoryId)
  if (error) throw error
}
