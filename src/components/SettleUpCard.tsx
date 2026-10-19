import { useCallback, useEffect, useMemo, useState } from 'react'
import { useData } from '../data/DataProvider'
import { fetchLatestSettlement, fetchSharedTxns, recordSettlement } from '../data/settlements'
import { useRealtime } from '../data/useRealtime'
import { settleUp } from '../domain/settleUp'
import { formatAUD, formatDayMonth } from '../domain/money'
import type { Settlement } from '../data/types'

/** Shared costs (marked on a transaction) split 50/50 — who owes whom, and a one-tap "settled". */
export function SettleUpCard() {
  const { profiles, me } = useData()
  const [last, setLast] = useState<Settlement | null>(null)
  const [txns, setTxns] = useState<{ owner_id: string; amount: number; txn_date: string }[]>([])
  const [busy, setBusy] = useState(false)
  const partner = profiles.find((p) => p.id !== me?.id)

  const load = useCallback(() => {
    fetchLatestSettlement()
      .then(async (s) => {
        setLast(s)
        setTxns(await fetchSharedTxns(s ? s.settled_at.slice(0, 10) : null))
      })
      .catch(() => setTxns([]))
  }, [])
  useEffect(load, [load])
  useRealtime(['budget_transactions', 'budget_settlements'], load)

  const result = useMemo(
    () => (me && partner ? settleUp(txns, me.id, partner.id, last ? last.settled_at.slice(0, 10) : null) : null),
    [txns, me, partner, last],
  )
  if (!me || !partner || !result) return null
  if (result.total === 0 && !last) return null // nobody has marked anything shared yet

  const name = (id: string) => (id === me.id ? 'You' : profiles.find((p) => p.id === id)?.display_name ?? '?')
  const settle = async () => {
    if (!result.owes) return
    setBusy(true)
    try {
      await recordSettlement(result.owes.from, result.owes.to, result.owes.amount, me.id)
      load()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card">
      <h2>Shared costs {last && <span className="badge">since {formatDayMonth(last.settled_at.slice(0, 10))}</span>}</h2>
      {result.owes ? (
        <div className="row--between">
          <span>
            <strong>{name(result.owes.from)}</strong> {result.owes.from === me.id ? 'owe' : 'owes'} <strong>{name(result.owes.to) === 'You' ? 'you' : name(result.owes.to)}</strong>{' '}
            <span className="amount">{formatAUD(result.owes.amount)}</span>
          </span>
          <button className="btn btn--small btn--primary" disabled={busy} onClick={() => void settle()}>Settled</button>
        </div>
      ) : (
        <p className="txn__sub">All square ✓</p>
      )}
      <p className="txn__sub" style={{ whiteSpace: 'normal' }}>
        {formatAUD(result.total)} shared · you paid {formatAUD(result.paid.get(me.id) ?? 0)}, {partner.display_name} paid {formatAUD(result.paid.get(partner.id) ?? 0)}. Mark a transaction 👫 shared to add it.
      </p>
    </div>
  )
}
