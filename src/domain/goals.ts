import type { Goal } from '../data/types'

export interface GoalStatus {
  remaining: number
  pct: number
  /** Monthly saving needed to hit the target date; null without a date. */
  monthlyNeeded: number | null
  monthsLeft: number | null
  status: 'done' | 'ontrack' | 'behind' | 'overdue' | 'open'
}

/** Whole months from today to the target, at least 1 while it's in the future. */
function monthsUntil(todayIso: string, targetIso: string): number {
  const [ty, tm, td] = todayIso.split('-').map(Number)
  const [gy, gm, gd] = targetIso.split('-').map(Number)
  const months = (gy - ty) * 12 + (gm - tm) + (gd >= td ? 0 : -1)
  return Math.max(1, months)
}

/**
 * Where a goal stands. "On track" compares saved-so-far against a straight
 * line from when the goal was created to its target date.
 */
export function goalStatus(goal: Goal, todayIso: string): GoalStatus {
  const remaining = Math.max(0, goal.target_amount - goal.saved_amount)
  const pct = Math.min(1, goal.saved_amount / goal.target_amount)
  if (remaining === 0) return { remaining, pct, monthlyNeeded: 0, monthsLeft: 0, status: 'done' }
  if (!goal.target_date) return { remaining, pct, monthlyNeeded: null, monthsLeft: null, status: 'open' }
  if (goal.target_date < todayIso) return { remaining, pct, monthlyNeeded: remaining, monthsLeft: 0, status: 'overdue' }

  const monthsLeft = monthsUntil(todayIso, goal.target_date)
  const start = Date.parse(goal.created_at.slice(0, 10))
  const end = Date.parse(goal.target_date)
  const elapsed = end > start ? Math.min(1, (Date.parse(todayIso) - start) / (end - start)) : 1
  const expected = goal.target_amount * elapsed
  return {
    remaining,
    pct,
    monthlyNeeded: Math.round((remaining / monthsLeft) * 100) / 100,
    monthsLeft,
    status: goal.saved_amount + 0.005 >= expected * 0.95 ? 'ontrack' : 'behind',
  }
}
