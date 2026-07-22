import { supabase } from '../lib/supabase'
import type { TaxChecklistState } from './types'

export async function fetchChecklist(fy: number): Promise<TaxChecklistState[]> {
  const { data, error } = await supabase
    .from('tax_checklist_state')
    .select('*')
    .eq('fy', fy)
  if (error) throw error
  return (data ?? []) as TaxChecklistState[]
}

export async function setChecklistItem(ownerId: string, fy: number, itemKey: string, done: boolean): Promise<void> {
  const { error } = await supabase
    .from('tax_checklist_state')
    .upsert({ owner_id: ownerId, fy, item_key: itemKey, done }, { onConflict: 'owner_id,fy,item_key' })
  if (error) throw error
}
