import { supabase } from '../lib/supabase'
import type { Bill } from './types'

export async function fetchBills(): Promise<Bill[]> {
  const { data, error } = await supabase.from('budget_bills').select('*').order('next_due', { ascending: true })
  if (error) throw error
  return (data ?? []) as Bill[]
}

export type BillInput = Omit<Bill, 'id' | 'last_paid'>

export async function addBill(input: BillInput): Promise<void> {
  const { error } = await supabase.from('budget_bills').insert(input)
  if (error) throw error
}

export async function updateBill(id: string, patch: Partial<Omit<Bill, 'id'>>): Promise<void> {
  const { error } = await supabase.from('budget_bills').update(patch).eq('id', id)
  if (error) throw error
}

export async function deleteBill(id: string): Promise<void> {
  const { error } = await supabase.from('budget_bills').delete().eq('id', id)
  if (error) throw error
}
