import type { Cadence } from '../data/types'

export const PER_YEAR: Record<Cadence, number> = { weekly: 52, fortnightly: 26, monthly: 12, quarterly: 4, annual: 1 }

/** One subscription amount re-expressed at every display cadence. */
export function normaliseCadence(amount: number, cadence: Cadence): { weekly: number; monthly: number; yearly: number } {
  const yearly = amount * PER_YEAR[cadence]
  return { weekly: yearly / 52, monthly: yearly / 12, yearly }
}
