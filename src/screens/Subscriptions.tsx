import { useCallback, useEffect, useState } from 'react'
import { fetchSubscriptions, setStatus, syncSubscriptions } from '../data/subscriptions'
import { useAuth } from '../auth/AuthProvider'
import { useRealtime } from '../data/useRealtime'
import { formatAUD, formatDayMonth } from '../domain/money'
import type { Subscription, Cadence } from '../data/types'

const PER_YEAR: Record<Cadence, number> = { weekly: 52, fortnightly: 26, monthly: 12, quarterly: 4, annual: 1 }

export default function Subscriptions() {
  const { user } = useAuth()
  const [subs, setSubs] = useState<Subscription[]>([])
  const load = useCallback(() => {
    fetchSubscriptions().then(setSubs).catch(() => setSubs([]))
  }, [])
  useEffect(load, [load])
  useRealtime(['budget_subscriptions'], load)

  const candidates = subs.filter((s) => s.status === 'candidate')
  const confirmed = subs.filter((s) => s.status === 'confirmed')
  const yearly = confirmed.reduce((sum, s) => sum + s.amount * PER_YEAR[s.cadence], 0)

  const act = async (id: string, status: 'confirmed' | 'dismissed' | 'cancelled') => {
    await setStatus(id, status)
    load()
  }

  return (
    <div className="screen">
      <div className="row--between">
        <h1 className="brand">Subscriptions</h1>
        {user && (
          <button className="btn btn--small" onClick={() => void syncSubscriptions(user.id).then(load)}>Re-scan</button>
        )}
      </div>

      {candidates.length > 0 && (
        <div className="card">
          <h2>Looks like subscriptions <span className="badge">best guess</span></h2>
          {candidates.map((s) => (
            <div key={s.id} className="txn">
              <div className="txn__main">
                <div className="txn__desc">{s.name}</div>
                <div className="txn__sub">{formatAUD(s.amount)} {s.cadence} · next ~{s.next_expected ? formatDayMonth(s.next_expected) : '?'}</div>
              </div>
              <button className="btn btn--small btn--primary" onClick={() => void act(s.id, 'confirmed')}>Yes</button>
              <button className="btn btn--small" onClick={() => void act(s.id, 'dismissed')}>No</button>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <div className="row--between">
          <h2>Confirmed</h2>
          <span className="muted">{formatAUD(yearly)}/yr</span>
        </div>
        {confirmed.map((s) => {
          const first = s.price_history[0]?.amount
          const crept = first !== undefined && s.amount > first
          return (
            <div key={s.id} className="txn">
              <div className="txn__main">
                <div className="txn__desc">{s.name}</div>
                <div className="txn__sub">
                  {formatAUD(s.amount)} {s.cadence} · next ~{s.next_expected ? formatDayMonth(s.next_expected) : '?'}
                </div>
                {crept && (
                  <div className="txn__sub"><span className="badge badge--dup">was {formatAUD(first)}</span></div>
                )}
              </div>
              <button className="btn btn--small" onClick={() => void act(s.id, 'cancelled')}>Cancelled it</button>
            </div>
          )
        })}
        {confirmed.length === 0 && <p className="muted">Nothing confirmed yet — import some statements and check back.</p>}
      </div>
    </div>
  )
}
