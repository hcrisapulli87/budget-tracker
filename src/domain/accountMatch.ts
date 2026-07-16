import type { Account } from '../data/types'
import type { ParsedTxn } from './bankProfiles'

/** Digits-only view of a BSB / account number, tolerant of "062-692" formatting. */
export function digitsOf(raw: string | null | undefined): string {
  return (raw ?? '').replace(/\D/g, '')
}

/**
 * Group a parsed file's rows by their per-row account identifier.
 * Key '' collects rows without one (single-account exports) — those keep
 * today's behaviour and land in whichever account the user selected.
 */
export function groupByAccountRef(parsed: ParsedTxn[]): Map<string, ParsedTxn[]> {
  const groups = new Map<string, ParsedTxn[]>()
  for (const txn of parsed) {
    const key = txn.accountRef ?? ''
    const bucket = groups.get(key)
    if (bucket) bucket.push(txn)
    else groups.set(key, [txn])
  }
  return groups
}

/**
 * Find the configured account a row group belongs to. Banks format the
 * identifier differently between exports (BSB+number concatenated, number
 * alone, zero-padding between the two), so we accept any of:
 *   ref === bsb + number, ref === number, or ref starts with the BSB and
 *   ends with the number (padding in the middle).
 */
export function matchAccountByRef(ref: string, accounts: Account[]): Account | undefined {
  if (ref === '') return undefined
  return accounts.find((a) => {
    if (a.is_archived) return false
    const acct = digitsOf(a.account_number)
    if (acct === '') return false
    const bsb = digitsOf(a.bsb)
    if (ref === bsb + acct || ref === acct) return true
    return bsb !== '' && ref.startsWith(bsb) && ref.endsWith(acct)
  })
}

/** "062692" → "062-692" for display; leaves non-6-digit strings alone. */
export function formatBsb(bsb: string | null | undefined): string {
  const d = digitsOf(bsb)
  return d.length === 6 ? `${d.slice(0, 3)}-${d.slice(3)}` : d
}
