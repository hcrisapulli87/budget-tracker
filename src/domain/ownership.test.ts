import { describe, it, expect } from 'vitest'
import { effectiveRules, visibleTo } from './ownership'
import { matchRule } from './ruleEngine'
import type { Rule } from '../data/types'

const ME = 'me'
const PARTNER = 'partner'
const rule = (pattern: string, category_id: string, owner_id: string | null): Rule => ({
  id: `${owner_id}-${pattern}`, pattern, category_id, owner_id, hits: 0, created_from: 'correction',
})

describe('visibleTo', () => {
  it('keeps own and joint rows, drops the partner’s', () => {
    const rows = [{ owner_id: ME }, { owner_id: PARTNER }, { owner_id: null }]
    expect(visibleTo(rows, ME)).toEqual([{ owner_id: ME }, { owner_id: null }])
  })
})

describe('effectiveRules', () => {
  const rules = [
    rule('bunnings', 'shopping', null),
    rule('bunnings', 'home', ME),
    rule('bunnings', 'tools', PARTNER),
    rule('coles', 'groceries', null),
    rule('uber', 'transport', PARTNER),
  ]

  it('my correction beats the household default', () => {
    expect(matchRule('bunnings warehouse', effectiveRules(rules, ME))?.category_id).toBe('home')
  })

  it('never applies the partner’s corrections', () => {
    const mine = effectiveRules(rules, ME)
    expect(mine.some((r) => r.owner_id === PARTNER)).toBe(false)
    expect(matchRule('uber trip', mine)).toBeNull()
  })

  it('falls back to defaults I have not overridden', () => {
    expect(matchRule('coles local', effectiveRules(rules, ME))?.category_id).toBe('groceries')
  })
})
