import { describe, expect, it } from 'vitest'
import { formatAUD, parseAmount, parseAuDate, parseDayMonDate, isoToday, addDaysIso } from './money'

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

describe('parseDayMonDate (NAB "15 Jul 25", Macquarie "05 Mar 2023")', () => {
  it('parses d MMM yy', () => expect(parseDayMonDate('15 Jul 25')).toBe('2025-07-15'))
  it('parses dd MMM yyyy', () => expect(parseDayMonDate('05 Mar 2023')).toBe('2023-03-05'))
  it('parses single-digit day', () => expect(parseDayMonDate('5 Mar 2023')).toBe('2023-03-05'))
  it('accepts full month names', () => expect(parseDayMonDate('5 March 2023')).toBe('2023-03-05'))
  it('is case-insensitive', () => expect(parseDayMonDate('5 MAR 2023')).toBe('2023-03-05'))
  it('rejects unknown months', () => expect(parseDayMonDate('5 Foo 2023')).toBeNull())
  it('rejects headers', () => expect(parseDayMonDate('Transaction Date')).toBeNull())
})

describe('date helpers', () => {
  it('isoToday returns yyyy-mm-dd', () => expect(isoToday()).toMatch(/^\d{4}-\d{2}-\d{2}$/))
  it('addDaysIso adds days', () => expect(addDaysIso('2026-01-30', 3)).toBe('2026-02-02'))
})
