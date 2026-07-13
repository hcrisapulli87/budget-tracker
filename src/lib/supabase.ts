import { createClient } from '@supabase/supabase-js'

// Single client. The publishable key is a *public* browser key; the database is
// protected by Row-Level Security, not by hiding it.
const url = import.meta.env.VITE_SUPABASE_URL
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!url || !publishableKey || url.includes('placeholder')) {
  console.warn(
    '[tally] Supabase env not configured. Copy .env.example to .env and set ' +
      'VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY (same values as tandem/.env).',
  )
}

export const supabase = createClient(url, publishableKey)
