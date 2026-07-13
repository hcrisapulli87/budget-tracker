import { addDaysIso } from './money'
import type { Txn } from '../data/types'

export interface Template {
  description: string
  category_id: string | null
  account: string
  amount: number // positive dollars, spend implied
  count: number
}

/**
 * Quick-add tiles, learned from the user's own manual spends in the last 90
 * days: same description (case-insensitive) + category appearing twice or more.
 * Amount is the mode; ties go to the most recent. Zero setup, no table.
 */
export function deriveTemplates(txns: Txn[], todayIso: string, limit = 6): Template[] {
  const cutoff = addDaysIso(todayIso, -90)
  const groups = new Map<string, Txn[]>()
  for (const t of txns) {
    if (t.source !== 'manual' || t.amount >= 0 || t.txn_date < cutoff) continue
    const key = `${t.description.trim().toLowerCase()}|${t.category_id ?? ''}`
    groups.set(key, [...(groups.get(key) ?? []), t])
  }
  const templates: Template[] = []
  for (const rows of groups.values()) {
    if (rows.length < 2) continue
    const sorted = [...rows].sort((a, b) => (a.txn_date < b.txn_date ? 1 : -1)) // newest first
    const freq = new Map<number, number>()
    for (const r of rows) freq.set(Math.abs(r.amount), (freq.get(Math.abs(r.amount)) ?? 0) + 1)
    const best = Math.max(...freq.values())
    const modal = sorted.find((r) => freq.get(Math.abs(r.amount)) === best)!
    templates.push({
      description: modal.description,
      category_id: modal.category_id,
      account: sorted[0].account,
      amount: Math.abs(modal.amount),
      count: rows.length,
    })
  }
  return templates.sort((a, b) => b.count - a.count).slice(0, limit)
}
