import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { mockSupabase } from './demo/mockClient'

// Demo build (VITE_DEMO=true): use the in-memory mock — random pre-filled data,
// always signed in, no network. Otherwise the real Supabase client.
const isDemo = import.meta.env.VITE_DEMO === 'true'

// Single client. The publishable key is a *public* browser key; the database is
// protected by Row-Level Security, not by hiding it.
const url = import.meta.env.VITE_SUPABASE_URL
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!isDemo && (!url || !publishableKey || url.includes('placeholder'))) {
  console.warn(
    '[tally] Supabase env not configured. Copy .env.example to .env and set ' +
      'VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY (same values as tandem/.env).',
  )
}

export const supabase = (
  isDemo ? (mockSupabase as unknown as SupabaseClient) : createClient(url, publishableKey)
) as SupabaseClient
