import { useCallback, useEffect, useState } from 'react'
import { fetchSubscriptions, setStatus, syncSubscriptions } from '../data/subscriptions'
import { useAuth } from '../auth/AuthProvider'
import { useData } from '../data/DataProvider'
import { PersonSwitcher } from '../components/PersonSwitcher'
import { useRealtime } from '../data/useRealtime'
import { normaliseCadence } from '../domain/cadence'
import { formatAUD, formatDayMonth } from '../domain/money'
import { SegmentedControl } from '../components/ui/SegmentedControl'
import { EmptyState } from '../components/ui/EmptyState'
import type { Subscription } from '../data/types'

type View = 'weekly' | 'monthly' | 'yearly'
const SUFFIX: Record<View, string> = { weekly: '/wk', monthly: '/mo', yearly: '/yr' }

export default function Subscriptions() {
  const { user } = useAuth()
  const { viewId, readOnly } = useData()
  const [subs, setSubs] = useState<Subscription[]>([])
  const [view, setView] = useState<View>('monthly')
  const [scanning, setScanning] = useState(false)
  const [scanNote, setScanNote] = useState('')

  const load = useCallback(() => {
    if (!viewId) return
    fetchSubscriptions().then((s) => setSubs(s.filter((x) => x.owner_id === viewId))).catch(() => setSubs([]))
  }, [viewId])
  useEffect(load, [load])
  useRealtime(['budget_subscriptions'], load)

  const candidates = subs.filter((s) => s.status === 'candidate')
  const confirmed = subs.filter((s) => s.status === 'confirmed')
  const at = (s: Subscription) => normaliseCadence(s.amount, s.cadence)[view]
  const total = confirmed.reduce((sum, s) => sum + at(s), 0)


  const act = async (id: string, status: 'confirmed' | 'dismissed' | 'cancelled') => {
    await setStatus(id, status)
    load()
  }

  const rescan = async () => {
    if (!user || scanning) return
    setScanning(true)
    setScanNote('')
    try {
      const found = await syncSubscriptions(user.id)
      load()
      setScanNote(
        found > 0
          ? `Found ${found} new subscription${found > 1 ? 's' : ''} — review below.`
          : 'No new subscriptions — a merchant needs ≥3 similar charges before it counts as one.',
      )
    } catch {
      setScanNote('Scan failed — try again in a moment.')
    } finally {
      setScanning(false)
    }
  }

  return (
    <div className="screen">
      <div className="row--between">
        <h1 className="brand">Subscriptions</h1>
        <div className="row" style={{ gap: 8 }}>
          <PersonSwitcher />
          {user && !readOnly && (
            <button className="btn btn--small" disabled={scanning} onClick={() => void rescan()}>
              {scanning ? 'Scanning…' : 'Re-scan'}
            </button>
          )}
        </div>
      </div>
      {scanNote && <p className="txn__sub" style={{ whiteSpace: 'normal' }}>{scanNote}</p>}

      <div className="hero" style={{ cursor: 'default' }}>
        <div className="hero__label">Total · {view}</div>
        <div className="stat">{formatAUD(total)}<span style={{ fontSize: '1rem', color: 'var(--dim)' }}>{SUFFIX[view]}</span></div>
        <div style={{ marginTop: 12 }}>
          <SegmentedControl options={[{ value: 'weekly', label: '$/wk' }, { value: 'monthly', label: '$/mo' }, { value: 'yearly', label: '$/yr' }]} value={view} onChange={setView} />
        </div>
      </div>

      {!readOnly && candidates.length > 0 && (
        <div className="card card--tint">
          <h2>Looks like subscriptions <span className="badge">best guess</span></h2>
          {candidates.map((s) => (
            <div key={s.id} className="txn">
              <div className="txn__main">
                <div className="txn__desc">{s.name}</div>
                <div className="txn__sub">{formatAUD(s.amount)} {s.cadence} · next ~{s.next_expected ? formatDayMonth(s.next_expected) : '?'}</div>
              </div>
              <button className="btn btn--small btn--primary" onClick={() => void act(s.id, 'confirmed')}>Track</button>
              <button className="btn btn--small" onClick={() => void act(s.id, 'dismissed')}>No</button>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <h2>Active</h2>
        {confirmed.map((s) => {
          const first = s.price_history[0]?.amount
          const crept = first !== undefined && s.amount > first
          return (
            <div key={s.id} className="txn">
              <div className="txn__main">
                <div className="txn__desc">{s.name}</div>
                <div className="txn__sub">bills as {formatAUD(s.amount)} {s.cadence} · next ~{s.next_expected ? formatDayMonth(s.next_expected) : '?'}</div>
                {crept && <div className="txn__sub"><span className="badge badge--dup">↑ was {formatAUD(first)}</span></div>}
              </div>
              <div className="txn__side">
                <span className="amount">{formatAUD(at(s))}{SUFFIX[view]}</span>
                {!readOnly && <button className="chip" onClick={() => void act(s.id, 'cancelled')}>Cancelled it</button>}
              </div>
            </div>
          )
        })}
        {confirmed.length === 0 && <EmptyState icon="🔁" title="No confirmed subscriptions" hint="Import statements and check back — detections land above." />}
      </div>
    </div>
  )
}
