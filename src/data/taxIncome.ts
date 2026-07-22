import { supabase } from '../lib/supabase'
import type { TaxIncome } from './types'

export interface TaxIncomeInput {
  owner_id: string
  fy: number
  source_type: TaxIncome['source_type']
  payer: string
  amount: number
  date: string
  note?: string
}

export async function fetchIncome(fy: number): Promise<TaxIncome[]> {
  const { data, error } = await supabase
    .from('tax_income')
    .select('*')
    .eq('fy', fy)
    .order('date', { ascending: false })
  if (error) throw error
  return (data ?? []) as TaxIncome[]
}

export async function insertIncome(row: TaxIncomeInput): Promise<void> {
  const { error } = await supabase.from('tax_income').insert(row)
  if (error) throw error
}

export async function updateIncome(id: string, patch: Partial<TaxIncomeInput>): Promise<void> {
  const { error } = await supabase.from('tax_income').update(patch).eq('id', id)
  if (error) throw error
}

export async function deleteIncome(id: string): Promise<void> {
  const { error } = await supabase.from('tax_income').delete().eq('id', id)
  if (error) throw error
}
