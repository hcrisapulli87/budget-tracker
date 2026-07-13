import { describe, expect, it } from 'vitest'
import { formatAUD, parseAmount, parseAuDate, isoToday, addDaysIso } from './money'

describe('formatAUD', () => {
  it('formats dollars', () => expect(formatAUD(1234.5)).toBe('$1,234.50'))
  it('formats negatives', () => expect(formatAUD(-12)).toBe('-$12.00'))
})

describe('parseAmount', () => {
  it('parses plain numbers', () => expect(parseAmount('12.50')).toBe(12.5))
  it('parses negatives', () => expect(parseAmount('-12.50')).toBe(-12.5))
  it('strips $ and commas', () => expect(parseAmount('$1,234.56')).toBe(1234.56))
  it('treats parentheses as negative', () => expect(parseAmount('(45.00)')).toBe(-45))
  it('returns null for blanks', () => expect(parseAmount('  ')).toBeNull())
  it('returns null for junk', () => expect(parseAmount('abc')).toBeNull())
})

describe('parseAuDate', () => {
  it('parses dd/mm/yyyy', () => expect(parseAuDate('23/06/2026')).toBe('2026-06-23'))
  it('pads single digits', () => expect(parseAuDate('3/6/2026')).toBe('2026-06-03'))
  it('expands 2-digit years', () => expect(parseAuDate('23/06/26')).toBe('2026-06-23'))
  it('rejects month > 12', () => expect(parseAuDate('23/13/2026')).toBeNull())
  it('rejects non-dates', () => expect(parseAuDate('Description')).toBeNull())
})

describe('date helpers', () => {
  it('isoToday returns yyyy-mm-dd', () => expect(isoToday()).toMatch(/^\d{4}-\d{2}-\d{2}$/))
  it('addDaysIso adds days', () => expect(addDaysIso('2026-01-30', 3)).toBe('2026-02-02'))
})
