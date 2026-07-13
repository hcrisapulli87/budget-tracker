import { supabase } from '../lib/supabase'
import type { Budget } from './types'

export async function fetchBudgets(): Promise<Budget[]> {
  const { data, error } = await supabase.from('budget_budgets').select('*')
  if (error) throw error
  return (data ?? []) as Budget[]
}

export async function setBudget(categoryId: string, monthlyLimit: number): Promise<void> {
  const { error } = await supabase
    .from('budget_budgets')
    .upsert({ category_id: categoryId, monthly_limit: monthlyLimit }, { onConflict: 'category_id' })
  if (error) throw error
}

export async function clearBudget(categoryId: string): Promise<void> {
  const { error } = await supabase.from('budget_budgets').delete().eq('category_id', categoryId)
  if (error) throw error
}
