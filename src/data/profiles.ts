import { supabase } from '../lib/supabase'
import type { Profile } from './types'

export async function fetchProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase.from('profiles').select('id, display_name')
  if (error) throw error
  return (data ?? []) as Profile[]
}
