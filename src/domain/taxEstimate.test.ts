import { describe, it, expect } from 'vitest'
import { deductionValue, incomeTax, marginalRate } from './taxEstimate'

describe('incomeTax (Stage 3)', () => {
  it('matches the FY2025-26 brackets', () => {
    expect(incomeTax(18_200, 2026)).toBe(0)
    expect(incomeTax(45_000, 2026)).toBe(4_288)
    expect(incomeTax(135_000, 2026)).toBe(31_288)
    expect(incomeTax(200_000, 2026)).toBe(56_138)
  })
  it('uses the lower bottom rate from FY2026-27', () => {
    expect(incomeTax(45_000, 2027)).toBe(4_020)
    expect(marginalRate(40_000, 2028)).toBe(0.14)
  })
})

describe('deductionValue', () => {
  it('is the tax plus Medicare the deductions take off', () => {
    // $1,000 off a $90k income at 30% + 2%
    expect(deductionValue(90_000, 1_000, 2026)).toBe(320)
  })
  it('spans a bracket edge correctly', () => {
    // 500 at 30% + 500 at 16%, plus 2% Medicare on 1,000
    expect(deductionValue(45_500, 1_000, 2026)).toBe(250)
  })
  it('is nothing without income', () => {
    expect(deductionValue(0, 1_000, 2026)).toBe(0)
  })
})
