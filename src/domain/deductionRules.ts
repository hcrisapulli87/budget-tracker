import type { DeductionCategory } from '../data/types'

interface DeductionRule { pattern: string; category: DeductionCategory }

// Keyword → likely AU deduction category, matched against normaliseMerchant()
// output (lowercase, punctuation/numbers stripped). Longest pattern wins —
// same rule as domain/ruleEngine.ts. This is a suggestion, not a determination;
// the UI must always let the person confirm or change the category.
const RULES: DeductionRule[] = [
  // donations — registered-charity name fragments + generic "donate/donation"
  { pattern: 'rspca', category: 'donations' },
  { pattern: 'red cross', category: 'donations' },
  { pattern: 'unicef', category: 'donations' },
  { pattern: 'salvation army', category: 'donations' },
  { pattern: 'vinnies', category: 'donations' },
  { pattern: 'st vincent', category: 'donations' },
  { pattern: 'world vision', category: 'donations' },
  { pattern: 'cancer council', category: 'donations' },
  { pattern: 'beyond blue', category: 'donations' },
  { pattern: 'oxfam', category: 'donations' },
  { pattern: 'msf', category: 'donations' },
  { pattern: 'fred hollows', category: 'donations' },
  { pattern: 'guide dogs', category: 'donations' },
  { pattern: 'smith family', category: 'donations' },
  { pattern: 'donation', category: 'donations' },
  { pattern: 'donate', category: 'donations' },

  // self-education
  { pattern: 'udemy', category: 'self_education' },
  { pattern: 'coursera', category: 'self_education' },
  { pattern: 'tafe', category: 'self_education' },
  { pattern: 'university', category: 'self_education' },
  { pattern: 'linkedin learning', category: 'self_education' },
  { pattern: 'pluralsight', category: 'self_education' },
  { pattern: 'textbook', category: 'self_education' },

  // tools / equipment
  { pattern: 'bunnings', category: 'tools' },
  { pattern: 'officeworks', category: 'tools' },
  { pattern: 'total tools', category: 'tools' },

  // work-related affairs / union & professional fees / tax agent
  { pattern: 'union', category: 'other' },
  { pattern: 'cpa australia', category: 'other' },
  { pattern: 'chartered accountants', category: 'other' },
  { pattern: 'ahpra', category: 'other' },
  { pattern: 'h and r block', category: 'other' },
  { pattern: 'hr block', category: 'other' },
  { pattern: 'etax', category: 'other' },
  { pattern: 'tax agent', category: 'other' },
  { pattern: 'accountant', category: 'other' },
]

/** Best-guess deduction category for a spend transaction, or null if no rule matches. */
export function suggestDeductionCategory(merchantNorm: string): DeductionCategory | null {
  let best: DeductionRule | null = null
  for (const r of RULES) {
    if (merchantNorm.includes(r.pattern) && (!best || r.pattern.length > best.pattern.length)) {
      best = r
    }
  }
  return best?.category ?? null
}
