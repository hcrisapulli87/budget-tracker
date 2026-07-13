import { supabase } from '../lib/supabase'
import type { ImportRecord } from './types'

export async function createImport(input: {
  ownerId: string
  account: string
  filename: string
  rowCount: number
  newCount: number
  duplicateCount: number
}): Promise<ImportRecord> {
  const { data, error } = await supabase
    .from('budget_imports')
    .insert({
      owner_id: input.ownerId,
      account: input.account,
      filename: input.filename,
      row_count: input.rowCount,
      new_count: input.newCount,
      duplicate_count: input.duplicateCount,
    })
    .select()
    .single()
  if (error) throw error
  return data as ImportRecord
}

export async function fetchImports(limit = 10): Promise<ImportRecord[]> {
  const { data, error } = await supabase
    .from('budget_imports')
    .select('*')
    .order('imported_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []) as ImportRecord[]
}
