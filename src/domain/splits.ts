import type { TxnSplit } from '../data/types'

const cents = (n: number) => Math.round(n * 100)

/**
 * A split transaction counts as one row per part everywhere money is totted up
 * by category (budgets, trends, insights). Unsplit rows pass through untouched.
 * Each part keeps the parent's other fields (date, owner, merchant…).
 */
export function expandSplits<T extends { amount: number; category_id: string | null; splits?: TxnSplit[] | null }>(txns: T[]): T[] {
  const out: T[] = []
  for (const t of txns) {
    if (!t.splits || t.splits.length < 2) {
      out.push(t)
      continue
    }
    for (const s of t.splits) out.push({ ...t, amount: s.amount, category_id: s.category_id, splits: null })
  }
  return out
}

export type SplitProblem = 'too-few' | 'zero-part' | 'wrong-sign' | 'mismatch'

/** Why a proposed split can't be saved, or null when it's fine. */
export function validateSplits(total: number, parts: TxnSplit[]): SplitProblem | null {
  if (parts.length < 2) return 'too-few'
  if (parts.some((p) => cents(p.amount) === 0)) return 'zero-part'
  if (parts.some((p) => Math.sign(p.amount) !== Math.sign(total))) return 'wrong-sign'
  const sum = parts.reduce((s, p) => s + cents(p.amount), 0)
  return sum === cents(total) ? null : 'mismatch'
}

/** What's left to allocate (signed like the total), to the cent. */
export function splitRemainder(total: number, parts: TxnSplit[]): number {
  return (cents(total) - parts.reduce((s, p) => s + cents(p.amount), 0)) / 100
}
