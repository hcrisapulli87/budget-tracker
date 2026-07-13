import { useEffect } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Subscribe to Postgres row changes on the given tables and call `onChange` on
 * any insert/update/delete. We use this purely as an invalidation signal — the
 * consumer re-fetches for truth, which is simple and always consistent given how
 * little data there is.
 *
 * `onChange` should be stable (wrap it in useCallback) so we don't resubscribe
 * on every render.
 */
export function useRealtime(tables: string[], onChange: () => void) {
  const key = tables.join(',')
  useEffect(() => {
    const channel = supabase.channel(`tally:${key}`)
    for (const table of tables) {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        () => onChange(),
      )
    }
    channel.subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, onChange])
}
