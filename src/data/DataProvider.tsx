import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { fetchCategories } from './categories'
import { fetchProfiles } from './profiles'
import { fetchBudgets } from './budgets'
import type { Budget, Category, Profile, Rule } from './types'

interface DataContextValue {
  profiles: Profile[]
  categories: Category[]
  rules: Rule[]
  budgets: Budget[]
  ready: boolean
  reload: () => Promise<void>
}

const DataContext = createContext<DataContextValue | undefined>(undefined)

export function DataProvider({ children }: { children: ReactNode }) {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [rules, setRules] = useState<Rule[]>([])
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [ready, setReady] = useState(false)

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
    setRules(r)
    setBudgets(b)
    setReady(true)
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  return (
    <DataContext.Provider value={{ profiles, categories, rules, budgets, ready, reload }}>
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
