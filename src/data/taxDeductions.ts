import { supabase } from '../lib/supabase'
import { fyDateRange } from '../domain/fy'
import type { TaxDeduction, Txn } from './types'

export interface TaxDeductionInput {
  owner_id: string
  fy: number
  category: TaxDeduction['category']
  description: string
  amount: number
  date: string
  note?: string
}

export async function fetchManualDeductions(fy: number): Promise<TaxDeduction[]> {
  const { data, error } = await supabase
    .from('tax_deductions')
    .select('*')
    .eq('fy', fy)
    .order('date', { ascending: false })
  if (error) throw error
  return (data ?? []) as TaxDeduction[]
}

export async function insertDeduction(row: TaxDeductionInput): Promise<void> {
  const { error } = await supabase.from('tax_deductions').insert(row)
  if (error) throw error
}

export async function updateDeduction(id: string, patch: Partial<TaxDeductionInput>): Promise<void> {
  const { error } = await supabase.from('tax_deductions').update(patch).eq('id', id)
  if (error) throw error
}

export async function deleteDeduction(id: string): Promise<void> {
  const { error } = await supabase.from('tax_deductions').delete().eq('id', id)
  if (error) throw error
}

/** Tally transactions tagged deductible whose txn_date falls within this FY. */
export async function fetchTaggedDeductions(fy: number): Promise<Txn[]> {
  const { start, end } = fyDateRange(fy)
  const { data, error } = await supabase
    .from('budget_transactions')
    .select('*')
    .eq('deductible', true)
    .gte('txn_date', start)
    .lte('txn_date', end)
    .order('txn_date', { ascending: false })
  if (error) throw error
  return (data ?? []) as Txn[]
}
