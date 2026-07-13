// Tokens that carry no merchant identity in AU bank descriptions.
const NOISE = new Set([
  'eftpos', 'visa', 'debit', 'credit', 'purchase', 'tap', 'pending', 'card',
  'aus', 'au', 'nsw', 'vic', 'qld', 'wa', 'sa', 'tas', 'act', 'nt',
  'com', 'www', 'pty', 'ltd',
])

/**
 * Collapse a raw bank description to a stable merchant key: lowercase, drop
 * masked card refs, dates, numbers, punctuation and noise tokens. Same merchant
 * ⇒ same key across statements, which is what rules and recurrence key on.
 */
export function normaliseMerchant(description: string): string {
  return description
    .toLowerCase()
    .replace(/x{2,}\d+|\*{2,}\d+/g, ' ') // masked card numbers (xx4321, **1234)
    .replace(/\d{1,2}\/\d{1,2}(\/\d{2,4})?/g, ' ') // dates
    .replace(/[^a-z\s]/g, ' ') // remaining digits + punctuation
    .split(/\s+/)
    .filter((t) => t.length > 1 && !NOISE.has(t))
    .join(' ')
    .trim()
}
