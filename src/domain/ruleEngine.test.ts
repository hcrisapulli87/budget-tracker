import { describe, expect, it } from 'vitest'
import { matchRule } from './ruleEngine'
import type { Rule } from '../data/types'

const rule = (pattern: string, category_id: string): Rule => ({
  id: pattern,
  pattern,
  category_id,
  hits: 0,
  created_from: 'seed',
})

describe('matchRule', () => {
  const rules = [rule('woolworths', 'groceries'), rule('woolworths metro', 'eating-out'), rule('bp ', 'fuel')]
  it('matches by substring', () => {
    expect(matchRule('woolworths sydney', rules)?.category_id).toBe('groceries')
  })
  it('prefers the most specific (longest) pattern', () => {
    expect(matchRule('woolworths metro york st', rules)?.category_id).toBe('eating-out')
  })
  it('returns null when nothing matches', () => {
    expect(matchRule('some cafe', rules)).toBeNull()
  })
  it('ignores empty patterns', () => {
    expect(matchRule('anything', [rule('', 'x')])).toBeNull()
  })
})
