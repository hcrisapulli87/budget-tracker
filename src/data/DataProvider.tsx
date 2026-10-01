import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import { effectiveRules } from '../domain/ownership'
import { fetchCategories } from './categories'
import { fetchProfiles } from './profiles'
import { fetchBudgets } from './budgets'
import type { Budget, Category, Profile, Rule } from './types'

interface DataContextValue {
  /** Both people, signed-in user first. */
  profiles: Profile[]
  me: Profile | null
  /** Whose data every screen shows — you by default, the partner via the switcher. */
  viewing: Profile | null
  /** The viewed person's id (falls back to yours while profiles load). */
  viewId: string
  setViewing: (id: string) => void
  /** True while looking at the partner's data — all edit affordances hide. */
  readOnly: boolean
  categories: Category[]
  /** Rules that categorise YOUR transactions (your corrections + household defaults). */
  rules: Rule[]
  /** The viewed person's budgets. */
  budgets: Budget[]
  ready: boolean
  reload: () => Promise<void>
}

const DataContext = createContext<DataContextValue | undefined>(undefined)

export function DataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const myId = user?.id ?? ''
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [allRules, setAllRules] = useState<Rule[]>([])
  const [allBudgets, setAllBudgets] = useState<Budget[]>([])
  const [ready, setReady] = useState(false)
  // Like RecipeVault: not persisted — every launch opens on your own data.
  const [viewingId, setViewingId] = useState<string | null>(null)

  const reload = useCallback(async () => {
    const [p, c, r, b] = await Promise.all([
      fetchProfiles(),
      fetchCategories(),
      supabase.from('budget_rules').select('*').then(({ data, error }) => {
        if (error) throw error
        return (data ?? []) as Rule[]
      }),
      fetchBudgets().catch(() => [] as Budget[]), // tolerate a pre-v3 schema
    ])
    setProfiles(p)
    setCategories(c)
    setAllRules(r)
    setAllBudgets(b)
    setReady(true)
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const value = useMemo<DataContextValue>(() => {
    const ordered = [...profiles].sort((a, b) => Number(b.id === myId) - Number(a.id === myId))
    const me = ordered.find((p) => p.id === myId) ?? null
    const viewing = ordered.find((p) => p.id === viewingId) ?? me
    const viewId = viewing?.id ?? myId
    return {
      profiles: ordered,
      me,
      viewing,
      viewId,
      setViewing: setViewingId,
      readOnly: viewId !== myId,
      categories,
      rules: effectiveRules(allRules, myId),
      budgets: allBudgets.filter((b) => b.owner_id === viewId),
      ready,
      reload,
    }
  }, [profiles, myId, viewingId, categories, allRules, allBudgets, ready, reload])

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useData(): DataContextValue {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData must be used within a DataProvider')
  return ctx
}
