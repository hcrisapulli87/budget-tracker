export interface SharedTxn {
  owner_id: string
  amount: number
  txn_date: string
}

export interface SettleUp {
  /** what each person put into shared costs (refunds net off) */
  paid: Map<string, number>
  total: number
  /** null when square (within a cent) */
  owes: { from: string; to: string; amount: number } | null
}

/**
 * Shared costs are split 50/50: whoever paid more is owed half the
 * difference. Only spend since the last settlement counts (`sinceIso`).
 */
export function settleUp(txns: SharedTxn[], personA: string, personB: string, sinceIso: string | null): SettleUp {
  const paid = new Map<string, number>([[personA, 0], [personB, 0]])
  for (const t of txns) {
    if (sinceIso && t.txn_date <= sinceIso) continue
    if (!paid.has(t.owner_id)) continue
    paid.set(t.owner_id, paid.get(t.owner_id)! - t.amount)
  }
  const a = Math.round(paid.get(personA)! * 100) / 100
  const b = Math.round(paid.get(personB)! * 100) / 100
  paid.set(personA, a)
  paid.set(personB, b)
  const half = Math.round(((a - b) / 2) * 100) / 100
  const owes = Math.abs(half) < 0.01 ? null : half > 0 ? { from: personB, to: personA, amount: half } : { from: personA, to: personB, amount: -half }
  return { paid, total: Math.round((a + b) * 100) / 100, owes }
}
