import { describe, expect, it } from 'vitest'
import { auFinancialYear, fyDateRange, fyLabel } from './fy'

describe('auFinancialYear', () => {
  it('Jan–Jun belongs to the FY ending that year', () => {
    expect(auFinancialYear('2026-06-30')).toBe(2026)
    expect(auFinancialYear('2026-01-01')).toBe(2026)
  })
  it('Jul–Dec belongs to the FY ending next year', () => {
    expect(auFinancialYear('2026-07-01')).toBe(2027)
    expect(auFinancialYear('2026-12-31')).toBe(2027)
  })
})

describe('fyDateRange', () => {
  it('spans Jul 1 of the prior year to Jun 30 of fy', () => {
    expect(fyDateRange(2026)).toEqual({ start: '2025-07-01', end: '2026-06-30' })
  })
})

describe('fyLabel', () => {
  it('formats as FYyyyy–yy', () => {
    expect(fyLabel(2026)).toBe('FY2025–26')
  })
})
