import type { Txn } from '../data/types'

export interface SettleResult {
  /** each person's spend counted toward the shared pool, since the cutoff */
  yourSpend: number
  partnerSpend: number
  /** > 0 → partner owes you; < 0 → you owe partner; 0 → all square */
  net: number
  /** absolute dollars to move to even up */
  amount: number
  /** who is owed: 'you' | 'partner' | null when square */
  owed: 'you' | 'partner' | null
}

/**
 * Net-of-shared-expenses settle-up. Shared spend is split 50/50; whoever paid
 * more than their half is owed the difference back. Only outgoing spend (amount
 * < 0) counts, and only transactions dated after the last settlement — recording
 * a settlement resets the clock so the card collapses to "all square".
 *
 * Fully automatic: no per-transaction "shared?" flag to fill in (Harrison won't),
 * so all household spend counts. Refine later with a shared-category filter if wanted.
 */
export function computeSettlement(
  txns: Txn[],
  youId: string,
  partnerId: string,
  sinceDate: string | null,
): SettleResult {
  let yourSpend = 0
  let partnerSpend = 0
  for (const t of txns) {
    if (t.amount >= 0) continue // spending only
    if (sinceDate && t.txn_date <= sinceDate) continue
    const out = -t.amount
    if (t.owner_id === youId) yourSpend += out
    else if (t.owner_id === partnerId) partnerSpend += out
  }
  const net = (yourSpend - partnerSpend) / 2 // + → partner owes you
  const amount = Math.round(Math.abs(net) * 100) / 100
  const owed = amount < 0.01 ? null : net > 0 ? 'you' : 'partner'
  return { yourSpend, partnerSpend, net, amount, owed }
}
