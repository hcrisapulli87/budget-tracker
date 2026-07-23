import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchSubscriptions, setStatus, syncSubscriptions } from '../data/subscriptions'
import { useAuth } from '../auth/AuthProvider'
import { useData } from '../data/DataProvider'
import { useRealtime } from '../data/useRealtime'
import { normaliseCadence } from '../domain/cadence'
import { formatAUD, formatDayMonth } from '../domain/money'
import { SegmentedControl } from '../components/ui/SegmentedControl'
import { EmptyState } from '../components/ui/EmptyState'
import { PersonAvatar } from '../components/ui/PersonAvatar'
import type { Subscription } from '../data/types'

type View = 'weekly' | 'monthly' | 'yearly'
const SUFFIX: Record<View, string> = { weekly: '/wk', monthly: '/mo', yearly: '/yr' }

export default function Subscriptions() {
  const { user } = useAuth()
  const { profiles } = useData()
  const [subs, setSubs] = useState<Subscription[]>([])
  const [view, setView] = useState<View>('monthly')
  const [scanning, setScanning] = useState(false)
  const [scanNote, setScanNote] = useState('')

  const load = useCallback(() => {
    fetchSubscriptions().then(setSubs).catch(() => setSubs([]))
  }, [])
  useEffect(load, [load])
  useRealtime(['budget_subscriptions'], load)

  const candidates = subs.filter((s) => s.status === 'candidate')
  const confirmed = subs.filter((s) => s.status === 'confirmed')
  const at = (s: Subscription) => normaliseCadence(s.amount, s.cadence)[view]
  const total = confirmed.reduce((sum, s) => sum + at(s), 0)

  // per-owner monthly split (couple framing)
  const split = useMemo(() => {
    const by = new Map<string, number>()
    for (const s of confirmed) by.set(s.owner_id, (by.get(s.owner_id) ?? 0) + normaliseCadence(s.amount, s.cadence).monthly)
    return by
  }, [confirmed])
  const name = (id: string) => profiles.find((p) => p.id === id)?.display_name ?? '?'

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
        {user && (
          <button className="btn btn--small" disabled={scanning} onClick={() => void rescan()}>
            {scanning ? 'Scanning…' : 'Re-scan'}
          </button>
        )}
      </div>
      {scanNote && <p className="txn__sub" style={{ whiteSpace: 'normal' }}>{scanNote}</p>}

      <div className="hero" style={{ cursor: 'default' }}>
        <div className="hero__label">Total · {view}</div>
        <div className="stat">{formatAUD(total)}<span style={{ fontSize: '1rem', color: 'var(--dim)' }}>{SUFFIX[view]}</span></div>
        <div className="row" style={{ marginTop: 10, gap: 14 }}>
          {[...split.entries()].map(([id, amt]) => (
            <span key={id} className="row" style={{ gap: 6 }}>
              <PersonAvatar name={name(id)} isMe={id === user?.id} size={22} />
              <span className="txn__sub">{formatAUD(amt)}/mo</span>
            </span>
          ))}
        </div>
        <div style={{ marginTop: 12 }}>
          <SegmentedControl options={[{ value: 'weekly', label: '$/wk' }, { value: 'monthly', label: '$/mo' }, { value: 'yearly', label: '$/yr' }]} value={view} onChange={setView} />
        </div>
      </div>

      {candidates.length > 0 && (
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
              <PersonAvatar name={name(s.owner_id)} isMe={s.owner_id === user?.id} size={30} />
              <div className="txn__main">
                <div className="txn__desc">{s.name}</div>
                <div className="txn__sub">bills as {formatAUD(s.amount)} {s.cadence} · next ~{s.next_expected ? formatDayMonth(s.next_expected) : '?'}</div>
                {crept && <div className="txn__sub"><span className="badge badge--dup">↑ was {formatAUD(first)}</span></div>}
              </div>
              <div className="txn__side">
                <span className="amount">{formatAUD(at(s))}{SUFFIX[view]}</span>
                <button className="chip" onClick={() => void act(s.id, 'cancelled')}>Cancelled it</button>
              </div>
            </div>
          )
        })}
        {confirmed.length === 0 && <EmptyState icon="🔁" title="No confirmed subscriptions" hint="Import statements and check back — detections land above." />}
      </div>
    </div>
  )
}
