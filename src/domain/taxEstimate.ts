// Australian resident income tax (excluding offsets), by FY (fy = ending year, see domain/fy.ts).
// Stage 3 brackets from FY2024-25; the bottom rate falls to 15% in FY2026-27 and
// 14% from FY2027-28 (legislated 2025). Verify against ato.gov.au each year.
interface Bracket { over: number; rate: number }

const STAGE3 = (low: number): Bracket[] => [
  { over: 0, rate: 0 },
  { over: 18_200, rate: low },
  { over: 45_000, rate: 0.30 },
  { over: 135_000, rate: 0.37 },
  { over: 190_000, rate: 0.45 },
]

const BRACKETS: Record<number, Bracket[]> = {
  2025: STAGE3(0.16),
  2026: STAGE3(0.16),
  2027: STAGE3(0.15),
  2028: STAGE3(0.14),
}
const KNOWN = Object.keys(BRACKETS).map(Number)
export const MEDICARE_LEVY = 0.02

function bracketsFor(fy: number): Bracket[] {
  const key = fy < Math.min(...KNOWN) ? Math.min(...KNOWN) : fy > Math.max(...KNOWN) ? Math.max(...KNOWN) : fy
  return BRACKETS[key]
}

/** Income tax on a taxable income, before offsets and Medicare. */
export function incomeTax(taxable: number, fy: number): number {
  const b = bracketsFor(fy)
  let tax = 0
  for (let i = 0; i < b.length; i++) {
    const top = b[i + 1]?.over ?? Infinity
    if (taxable > b[i].over) tax += (Math.min(taxable, top) - b[i].over) * b[i].rate
  }
  return Math.round(tax * 100) / 100
}

export function marginalRate(taxable: number, fy: number): number {
  const b = bracketsFor(fy)
  return [...b].reverse().find((x) => taxable > x.over)?.rate ?? 0
}

/**
 * Roughly what your deductions are worth back: the tax (plus Medicare levy)
 * they take off your income. A guide only — offsets, HELP and the Medicare
 * low-income thresholds aren't modelled.
 */
export function deductionValue(income: number, deductions: number, fy: number): number {
  if (income <= 0 || deductions <= 0) return 0
  const after = Math.max(0, income - deductions)
  const saved = incomeTax(income, fy) - incomeTax(after, fy) + (income - after) * MEDICARE_LEVY
  return Math.round(saved * 100) / 100
}
