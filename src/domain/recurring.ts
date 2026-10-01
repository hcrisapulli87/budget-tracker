import { normaliseCadence } from './cadence'
import type { Bill, Subscription } from '../data/types'

/**
 * One list for every repeating payment. Bills are the ones you add by hand
 * (rent, power — and what the Discord bot reminds about); subscriptions are the
 * ones Tally spotted in your statements and you confirmed. Same row either way.
 */
export type RecurringItem =
  | { kind: 'bill'; id: string; name: string; amount: number; monthly: number; next: string | null; joint: boolean; bill: Bill }
  | { kind: 'sub'; id: string; name: string; amount: number; monthly: number; next: string | null; joint: false; sub: Subscription }

export function buildRecurring(bills: Bill[], subs: Subscription[]): RecurringItem[] {
  const items: RecurringItem[] = [
    ...bills.map((b) => ({
      kind: 'bill' as const,
      id: b.id,
      name: b.name,
      amount: b.amount,
      monthly: normaliseCadence(b.amount, b.frequency).monthly,
      next: b.next_due,
      joint: b.owner_id === null,
      bill: b,
    })),
    ...subs
      .filter((s) => s.status === 'confirmed')
      .map((s) => ({
        kind: 'sub' as const,
        id: s.id,
        name: s.name,
        amount: s.amount,
        monthly: normaliseCadence(s.amount, s.cadence).monthly,
        next: s.next_expected,
        joint: false as const,
        sub: s,
      })),
  ]
  // soonest first; anything without a known next date sinks to the bottom
  return items.sort((a, b) => (a.next ?? '9999').localeCompare(b.next ?? '9999') || a.name.localeCompare(b.name))
}

/** Items whose next charge lands in [fromIso, toIso]. */
export function dueBetween(items: RecurringItem[], fromIso: string, toIso: string): RecurringItem[] {
  return items.filter((i) => i.next !== null && i.next >= fromIso && i.next <= toIso)
}

/** "in 3d", "tomorrow", "due today", "2d overdue". */
export function countdown(iso: string, todayIso: string): string {
  const d = Math.round((Date.parse(iso) - Date.parse(todayIso)) / 86_400_000)
  if (d < 0) return `${-d}d overdue`
  if (d === 0) return 'due today'
  if (d === 1) return 'tomorrow'
  return `in ${d}d`
}
