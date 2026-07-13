import { describe, expect, it } from 'vitest'
import { normaliseMerchant } from './merchant'

describe('normaliseMerchant', () => {
  it('lowercases and strips store numbers/state/country', () => {
    expect(normaliseMerchant('WOOLWORTHS 1234 SYDNEY NSW AUS')).toBe('woolworths sydney')
  })
  it('strips masked card refs', () => {
    expect(normaliseMerchant('NETFLIX.COM Card xx4321')).toBe('netflix')
  })
  it('strips dates and receipt numbers', () => {
    expect(normaliseMerchant('BP 2345 FUEL 12/06 REF 998877')).toBe('bp fuel ref')
  })
  it('collapses whitespace', () => {
    expect(normaliseMerchant('  UBER   *EATS  ')).toBe('uber eats')
  })
  it('returns empty for pure noise', () => {
    expect(normaliseMerchant('12/06/2026 4321')).toBe('')
  })
})
