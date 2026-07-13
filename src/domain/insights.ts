import { formatAUD } from './money'
import type { Subscription } from '../data/types'

export interface Insight {
  kind: 'category-spike' | 'price-rise' | 'unused-sub' | 'streaming-overlap'
  message: string
}

export interface InsightsInput {
  categoryNames: Map<string, string>
  /** totals = last 4 calendar months, oldest → newest (current month last). */
  monthlyByCategory: { categoryId: string; totals: number[] }[]
  subs: Subscription[]
  today: string
}

const STREAMING = ['netflix', 'stan', 'disney', 'binge', 'prime video', 'paramount', 'apple tv', 'youtube premium']
const CYCLE_DAYS: Record<Subscription['cadence'], number> = {
  weekly: 7,
  fortnightly: 14,
  monthly: 30,
  quarterly: 91,
  annual: 365,
}

/** Rule-based observations, deliberately few and framed as best guesses. */
export function buildInsights(input: InsightsInput): Insight[] {
  const out: Insight[] = []

  for (const { categoryId, totals } of input.monthlyByCategory) {
    if (totals.length < 4) continue
    const current = totals[totals.length - 1]
    const prior = totals.slice(0, -1)
    const avg = prior.reduce((a, b) => a + b, 0) / prior.length
    if (avg > 0 && current > avg * 1.25 && current - avg >= 50) {
      const name = input.categoryNames.get(categoryId) ?? 'A category'
      out.push({
        kind: 'category-spike',
        message: `${name} is ${formatAUD(current - avg)} above its usual ~${formatAUD(avg)}/month.`,
      })
    }
  }

  const confirmed = input.subs.filter((s) => s.status === 'confirmed')

  for (const s of confirmed) {
    const first = s.price_history[0]?.amount
    const last = s.price_history[s.price_history.length - 1]?.amount
    if (first !== undefined && last !== undefined && last > first) {
      out.push({
        kind: 'price-rise',
        message: `${s.name} has crept from ${formatAUD(first)} to ${formatAUD(last)}.`,
      })
    }
  }

  for (const s of confirmed) {
    if (!s.next_expected) continue
    const staleDays = (Date.parse(input.today) - Date.parse(s.next_expected)) / 86_400_000
    if (staleDays > CYCLE_DAYS[s.cadence]) {
      out.push({
        kind: 'unused-sub',
        message: `${s.name} hasn't charged since ${s.next_expected} was expected — cancelled, or worth cancelling?`,
      })
    }
  }

  const streaming = confirmed.filter((s) => STREAMING.some((k) => s.merchant_norm.includes(k)))
  if (streaming.length >= 3) {
    const total = streaming.reduce((sum, s) => sum + s.amount, 0)
    out.push({
      kind: 'streaming-overlap',
      message: `${streaming.length} streaming services (~${formatAUD(total)}/cycle) — rotating them could save a bit.`,
    })
  }

  return out
}
