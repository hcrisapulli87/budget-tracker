import type { IncomeSourceType } from '../data/types'

interface IncomeRule { pattern: string; source: Extract<IncomeSourceType, 'salary' | 'investment'> }

const RULES: IncomeRule[] = [
  { pattern: 'dividend', source: 'investment' },
  { pattern: 'franking', source: 'investment' },
  { pattern: 'interest', source: 'investment' },
  { pattern: 'distribution', source: 'investment' },
  { pattern: 'commsec', source: 'investment' },
  { pattern: 'vanguard', source: 'investment' },
  { pattern: 'betashares', source: 'investment' },
  { pattern: 'salary', source: 'salary' },
  { pattern: 'payroll', source: 'salary' },
  { pattern: 'pay run', source: 'salary' },
  { pattern: 'wages', source: 'salary' },
]

/** Best-guess income source for a positive (money-in) transaction. Falls back to 'other'. */
export function classifyIncome(merchantNorm: string): IncomeSourceType {
  let best: IncomeRule | null = null
  for (const r of RULES) {
    if (merchantNorm.includes(r.pattern) && (!best || r.pattern.length > best.pattern.length)) {
      best = r
    }
  }
  return best?.source ?? 'other'
}
