import type { ParsedTxn } from './bankProfiles'

// A transparent deterministic key rather than an actual hash — nothing to
// reverse-engineer when a dedupe decision looks wrong in the Table Editor.
export function importKey(account: string, dateIso: string, amount: number, description: string): string {
  return [
    account.trim().toLowerCase(),
    dateIso,
    amount.toFixed(2),
    description.trim().toLowerCase().replace(/\s+/g, ' '),
  ].join('|')
}

export interface KeyedTxn {
  txn: ParsedTxn
  key: string
}

/**
 * Deterministic keys for a batch; identical in-file rows (two identical coffees,
 * same day) get #2/#3… suffixes so they aren't wrongly deduped, while a
 * re-imported file regenerates identical keys and dedupes exactly.
 */
export function assignKeys(txns: ParsedTxn[], account: string): KeyedTxn[] {
  const seen = new Map<string, number>()
  return txns.map((txn) => {
    const base = importKey(account, txn.dateIso, txn.amount, txn.description)
    const n = (seen.get(base) ?? 0) + 1
    seen.set(base, n)
    return { txn, key: n === 1 ? base : `${base}#${n}` }
  })
}
