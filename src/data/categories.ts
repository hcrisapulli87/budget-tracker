import { supabase } from '../lib/supabase'
import type { Category } from './types'

export async function fetchCategories(): Promise<Category[]> {
  const { data, error } = await supabase
    .from('budget_categories')
    .select('*')
    .eq('is_archived', false)
    .order('sort_order', { ascending: true })
  if (error) throw error
  return (data ?? []) as Category[]
}

export async function addCategory(input: {
  name: string
  colour: string
  icon: string
  sortOrder: number
}): Promise<void> {
  const { error } = await supabase.from('budget_categories').insert({
    name: input.name,
    colour: input.colour,
    icon: input.icon,
    sort_order: input.sortOrder,
  })
  if (error) throw error
}

export async function updateCategory(
  id: string,
  patch: Partial<Pick<Category, 'name' | 'colour' | 'icon' | 'is_archived'>>,
): Promise<void> {
  const { error } = await supabase.from('budget_categories').update(patch).eq('id', id)
  if (error) throw error
}
