import { supabase } from '../lib/supabase'
import type { Profile } from './types'

/**
 * Tally's people. profiles is shared with the other household apps, so it can
 * hold logins that aren't Tally users — budget_members says who belongs here
 * (when it's empty or missing, everyone does).
 */
export async function fetchProfiles(): Promise<Profile[]> {
  const [profilesRes, membersRes] = await Promise.all([
    supabase.from('profiles').select('id, display_name'),
    supabase.from('budget_members').select('profile_id'),
  ])
  if (profilesRes.error) throw profilesRes.error
  const profiles = (profilesRes.data ?? []) as Profile[]
  const members = new Set(((membersRes.error ? [] : membersRes.data) ?? []).map((m) => m.profile_id as string))
  return members.size === 0 ? profiles : profiles.filter((p) => members.has(p.id))
}
