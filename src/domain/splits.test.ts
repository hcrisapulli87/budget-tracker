import { describe, it, expect } from 'vitest'
import { expandSplits, splitRemainder, validateSplits } from './splits'

describe('expandSplits', () => {
  it('turns a split row into one row per part and leaves others alone', () => {
    const rows = expandSplits([
      { id: 'a', amount: -100, category_id: 'groc', splits: [{ category_id: 'groc', amount: -60 }, { category_id: 'home', amount: -40 }] },
      { id: 'b', amount: -5, category_id: 'coffee', splits: null },
    ])
    expect(rows).toEqual([
      { id: 'a', amount: -60, category_id: 'groc', splits: null },
      { id: 'a', amount: -40, category_id: 'home', splits: null },
      { id: 'b', amount: -5, category_id: 'coffee', splits: null },
    ])
  })

  it('ignores a degenerate one-part split', () => {
    const row = { amount: -10, category_id: 'x', splits: [{ category_id: 'y', amount: -10 }] }
    expect(expandSplits([row])).toEqual([row])
  })
})

describe('validateSplits', () => {
  it('accepts parts that sum to the total to the cent', () => {
    expect(validateSplits(-100.1, [{ category_id: 'a', amount: -33.37 }, { category_id: 'b', amount: -66.73 }])).toBeNull()
  })
  it('rejects too few, zero, wrong-sign and mismatched parts', () => {
    expect(validateSplits(-10, [{ category_id: 'a', amount: -10 }])).toBe('too-few')
    expect(validateSplits(-10, [{ category_id: 'a', amount: -10 }, { category_id: 'b', amount: 0 }])).toBe('zero-part')
    expect(validateSplits(-10, [{ category_id: 'a', amount: -12 }, { category_id: 'b', amount: 2 }])).toBe('wrong-sign')
    expect(validateSplits(-10, [{ category_id: 'a', amount: -4 }, { category_id: 'b', amount: -5 }])).toBe('mismatch')
  })
  it('reports the remainder left to allocate', () => {
    expect(splitRemainder(-10, [{ category_id: 'a', amount: -4.25 }])).toBe(-5.75)
  })
})
