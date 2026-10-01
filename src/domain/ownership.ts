import type { Rule } from '../data/types'

/**
 * Rows a person sees in their view: their own plus owner-less "joint" rows
 * (joint bills, joint accounts). Never the partner's personal rows.
 */
export function visibleTo<T extends { owner_id: string | null }>(rows: T[], ownerId: string): T[] {
  return rows.filter((r) => r.owner_id === ownerId || r.owner_id === null)
}

/**
 * The rules that categorise one person's transactions: their own corrections,
 * plus the owner-less household defaults they haven't overridden. The partner's
 * corrections never apply — fixing a category is personal now.
 */
export function effectiveRules(rules: Rule[], ownerId: string): Rule[] {
  const own = rules.filter((r) => r.owner_id === ownerId)
  const overridden = new Set(own.map((r) => r.pattern))
  return [...own, ...rules.filter((r) => r.owner_id === null && !overridden.has(r.pattern))]
}
