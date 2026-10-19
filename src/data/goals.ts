import { supabase } from '../lib/supabase'
import type { Goal } from './types'

export async function fetchGoals(): Promise<Goal[]> {
  const { data, error } = await supabase.from('budget_goals').select('*').order('created_at')
  if (error) throw error
  return (data ?? []) as Goal[]
}

export interface GoalInput {
  owner_id: string | null
  name: string
  icon: string
  target_amount: number
  target_date: string | null
}

export async function addGoal(input: GoalInput): Promise<void> {
  const { error } = await supabase.from('budget_goals').insert({ ...input, saved_amount: 0, is_archived: false, created_at: new Date().toISOString() })
  if (error) throw error
}

export async function updateGoal(id: string, patch: Partial<GoalInput & { saved_amount: number; is_archived: boolean }>): Promise<void> {
  const { error } = await supabase.from('budget_goals').update(patch).eq('id', id)
  if (error) throw error
}

export async function deleteGoal(id: string): Promise<void> {
  const { error } = await supabase.from('budget_goals').delete().eq('id', id)
  if (error) throw error
}
