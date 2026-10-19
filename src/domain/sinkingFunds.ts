import { normaliseCadence } from './cadence'
import type { RecurringItem } from './recurring'
import type { Cadence } from '../data/types'

const CYCLE_DAYS: Partial<Record<Cadence, number>> = { quarterly: 91, annual: 365 }

export interface SinkingFund {
  key: string
  name: string
  amount: number
  next: string
  /** Put this much aside every month and the bill is covered when it lands. */
  monthly: number
  /** How much of this cycle's bill should already be set aside by today. */
  shouldHave: number
  /** 0–1 through the current cycle. */
  progress: number
}

/**
 * Irregular bills (quarterly rego, annual insurance) turned into a steady
 * monthly set-aside, so they stop blowing up the month they land in.
 */
export function sinkingFunds(items: RecurringItem[], todayIso: string): SinkingFund[] {
  const out: SinkingFund[] = []
  for (const i of items) {
    const cadence: Cadence = i.kind === 'bill' ? i.bill.frequency : i.sub.cadence
    const cycle = CYCLE_DAYS[cadence]
    if (!cycle || !i.next) continue
    const daysLeft = Math.max(0, (Date.parse(i.next) - Date.parse(todayIso)) / 86_400_000)
    const progress = Math.min(1, Math.max(0, 1 - daysLeft / cycle))
    out.push({
      key: `${i.kind}-${i.id}`,
      name: i.name,
      amount: i.amount,
      next: i.next,
      monthly: Math.round(normaliseCadence(i.amount, cadence).monthly * 100) / 100,
      shouldHave: Math.round(i.amount * progress * 100) / 100,
      progress,
    })
  }
  return out.sort((a, b) => a.next.localeCompare(b.next))
}
