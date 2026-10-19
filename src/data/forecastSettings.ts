import { supabase } from '../lib/supabase'
import type { ForecastSettings } from './types'

export const DEFAULT_BUFFER = 100

export async function fetchForecastSettings(ownerId: string): Promise<ForecastSettings | null> {
  const { data, error } = await supabase.from('budget_settings').select('*').eq('owner_id', ownerId).maybeSingle()
  if (error) throw error
  return (data as ForecastSettings | null) ?? null
}

export async function saveForecastSettings(settings: ForecastSettings): Promise<void> {
  const { error } = await supabase.from('budget_settings').upsert({ ...settings, updated_at: new Date().toISOString() }, { onConflict: 'owner_id' })
  if (error) throw error
}
