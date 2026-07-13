export function formatAUD(amount: number): string {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(amount)
}

/** Bank-CSV amount → number. Handles $, commas, and (parentheses) negatives. */
export function parseAmount(raw: string): number | null {
  const s = raw.trim()
  if (!s) return null
  const negative = /^\(.*\)$/.test(s)
  const cleaned = s.replace(/[()$,\s]/g, '')
  if (!/^[+-]?\d+(\.\d+)?$/.test(cleaned)) return null
  const n = Number(cleaned)
  return negative ? -Math.abs(n) : n
}

/** dd/mm/yyyy (AU bank exports) → ISO yyyy-mm-dd. */
export function parseAuDate(raw: string): string | null {
  const m = raw.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
  if (!m) return null
  const day = Number(m[1])
  const month = Number(m[2])
  const year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function isoToday(): string {
  return new Date().toISOString().slice(0, 10)
}

export function addDaysIso(iso: string, days: number): string {
  return new Date(Date.parse(iso) + days * 86_400_000).toISOString().slice(0, 10)
}
