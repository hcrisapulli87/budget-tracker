import type { Rule } from '../data/types'

/** Longest matching pattern wins — "woolworths metro" beats "woolworths". */
export function matchRule(merchantNorm: string, rules: Rule[]): Rule | null {
  let best: Rule | null = null
  for (const r of rules) {
    if (!r.pattern) continue
    if (merchantNorm.includes(r.pattern) && (!best || r.pattern.length > best.pattern.length)) {
      best = r
    }
  }
  return best
}
