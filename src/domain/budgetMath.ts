export interface BudgetPace {
  expected: number
  status: 'over' | 'hot' | 'ontrack'
}

/** Where the month's spend *should* be by today, and whether we're past it. */
export function budgetPace(spent: number, limit: number, dayOfMonth: number, daysInMonth: number): BudgetPace {
  const expected = limit * (dayOfMonth / daysInMonth)
  const status = spent > limit ? 'over' : spent > expected * 1.1 ? 'hot' : 'ontrack'
  return { expected, status }
}
