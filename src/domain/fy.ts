/** Australian financial year: Jul 1 – Jun 30. `fy` is the ending calendar year (2026 = FY2025-26). */
export function auFinancialYear(iso: string): number {
  const [y, m] = iso.split('-').map(Number)
  return m >= 7 ? y + 1 : y
}

export function fyDateRange(fy: number): { start: string; end: string } {
  return { start: `${fy - 1}-07-01`, end: `${fy}-06-30` }
}

export function fyLabel(fy: number): string {
  return `FY${fy - 1}–${String(fy).slice(2)}`
}

export function currentFy(): number {
  return auFinancialYear(new Date().toISOString().slice(0, 10))
}
