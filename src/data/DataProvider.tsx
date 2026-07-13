import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { fetchCategories } from './categories'
import { fetchProfiles } from './profiles'
import type { Category, Profile, Rule } from './types'

interface DataContextValue {
  profiles: Profile[]
  categories: Category[]
  rules: Rule[]
  ready: boolean
  reload: () => Promise<void>
}

const DataContext = createContext<DataContextValue | undefined>(undefined)

export function DataProvider({ children }: { children: ReactNode }) {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [rules, setRules] = useState<Rule[]>([])
  const [ready, setReady] = useState(false)

  const reload = useCallback(async () => {
    const [p, c, r] = await Promise.all([
      fetchProfiles(),
      fetchCategories(),
      supabase.from('budget_rules').select('*').then(({ data, error }) => {
        if (error) throw error
        return (data ?? []) as Rule[]
      }),
    ])
    setProfiles(p)
    setCategories(c)
    setRules(r)
    setReady(true)
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  return (
    <DataContext.Provider value={{ profiles, categories, rules, ready, reload }}>
      {children}
    </DataContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useData(): DataContextValue {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData must be used within a DataProvider')
  return ctx
}
