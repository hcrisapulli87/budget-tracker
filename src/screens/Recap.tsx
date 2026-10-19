import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useData } from '../data/DataProvider'
import { fetchTransactions } from '../data/transactions'
import { fetchGoals } from '../data/goals'
import { fetchSubscriptions } from '../data/subscriptions'
import { useRealtime } from '../data/useRealtime'
import { buildRecap } from '../domain/recap'
import type { PersonRecap } from '../domain/recap'
import { shiftMonth } from '../domain/budgetMath'
import { expandSplits } from '../domain/splits'
import { goalStatus } from '../domain/goals'
import { formatAUD, formatDayMonth, isoToday } from '../domain/money'
import { PersonAvatar } from '../components/ui/PersonAvatar'
import { ProgressBar } from '../components/ui/ProgressBar'
import type { Goal, Subscription, Txn } from '../data/types'

function monthLabel(m: string): string {
  return new Date(`${m}-01T00:00:00`).toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })
}

/**
 * The monthly "money date": both people's month side by side, the shared
 * goals and what changed — the one screen to go through together.
 */
export default function Recap() {
  const { profiles, me, categories } = useData()
  const thisMonth = isoToday().slice(0, 7)
  // default to the last full month once the new one is a few days old
  const [month, setMonth] = useState(() => (Number(isoToday().slice(8, 10)) <= 7 ? shiftMonth(thisMonth, -1) : thisMonth))
  const [txns, setTxns] = useState<Txn[]>([])
  const [goals, setGoals] = useState<Goal[]>([])
  const [subs, setSubs] = useState<Subscription[]>([])

  const load = useCallback(() => {
    const [y, m] = month.split('-').map(Number)
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
    fetchTransactions(`${shiftMonth(month, -1)}-01`, `${month}-${String(last).padStart(2, '0')}`).then(setTxns).catch(() => setTxns([]))
    fetchGoals().then((g) => setGoals(g.filter((x) => !x.is_archived))).catch(() => setGoals([]))
    fetchSubscriptions().then(setSubs).catch(() => setSubs([]))
  }, [month])
  useEffect(load, [load])
  useRealtime(['budget_transactions', 'budget_goals'], load)

  const excluded = useMemo(() => new Set(categories.filter((c) => c.exclude_from_analytics).map((c) => c.id)), [categories])
  const recaps = useMemo(() => {
    const expanded = expandSplits(txns)
    return profiles.map((p) => ({ person: p, recap: buildRecap(expanded.filter((t) => t.owner_id === p.id), month, excluded) }))
  }, [txns, profiles, month, excluded])

  const sharedTotal = useMemo(
    () => txns.filter((t) => t.shared && t.amount < 0 && t.txn_date.startsWith(month)).reduce((s, t) => s - t.amount, 0),
    [txns, month],
  )
  const priceRises = subs.filter((s) => {
    const h = s.price_history
    return s.status === 'confirmed' && h.length > 1 && h[h.length - 1].date.startsWith(month) && h[h.length - 1].amount > h[h.length - 2].amount
  })
  const joint = goals.filter((g) => g.owner_id === null)
  const cat = (id: string | null) => categories.find((c) => c.id === id)
  const householdNet = recaps.reduce((s, r) => s + r.recap.net, 0)

  return (
    <div className="screen">
      <div className="row--between">
        <h1 className="brand">Recap</h1>
      </div>
      <div className="row--between card">
        <button className="btn btn--small btn--pager" onClick={() => setMonth((m) => shiftMonth(m, -1))} aria-label="Previous month">‹</button>
        <strong>{monthLabel(month)}{month === thisMonth ? ' (so far)' : ''}</strong>
        <button className="btn btn--small btn--pager" disabled={month >= thisMonth} onClick={() => setMonth((m) => shiftMonth(m, 1))} aria-label="Next month">›</button>
      </div>

      <div className="hero hero--tint" style={{ cursor: 'default' }}>
        <div className="hero__label">Together · {householdNet >= 0 ? 'kept' : 'overspent'}</div>
        <div className={`stat${householdNet < 0 ? ' error' : ''}`}>{formatAUD(Math.abs(householdNet))}</div>
        <div className="txn__sub" style={{ whiteSpace: 'normal' }}>
          {recaps.map((r) => `${r.person.id === me?.id ? 'You' : r.person.display_name} ${r.recap.net >= 0 ? 'kept' : 'overspent'} ${formatAUD(Math.abs(r.recap.net))}`).join(' · ')}
          {sharedTotal > 0 && ` · ${formatAUD(sharedTotal)} of shared costs`}
        </div>
      </div>

      {recaps.map(({ person, recap }) => (
        <PersonCard key={person.id} name={person.id === me?.id ? 'You' : person.display_name} avatarName={person.display_name} isMe={person.id === me?.id} recap={recap} cat={cat} />
      ))}

      {joint.length > 0 && (
        <div className="card">
          <h2>Joint goals</h2>
          {joint.map((g) => {
            const s = goalStatus(g, isoToday())
            return (
              <div key={g.id} style={{ marginBottom: 10 }}>
                <div className="row--between" style={{ fontSize: '0.88rem' }}>
                  <span>{g.icon} {g.name}</span>
                  <span className="muted">{Math.round(s.pct * 100)}% · {formatAUD(s.remaining)} to go</span>
                </div>
                <ProgressBar value={g.saved_amount} max={g.target_amount} tone={s.status === 'behind' ? 'warn' : 'ok'} />
              </div>
            )
          })}
        </div>
      )}

      {priceRises.length > 0 && (
        <div className="card">
          <h2>Price rises this month</h2>
          {priceRises.map((s) => (
            <p key={s.id} className="txn__sub" style={{ whiteSpace: 'normal' }}>
              {s.name}: {formatAUD(s.price_history[s.price_history.length - 2].amount)} → {formatAUD(s.amount)} — worth a call?
            </p>
          ))}
        </div>
      )}

      <div className="card">
        <h2>Talk about</h2>
        <ul className="txn__sub" style={{ whiteSpace: 'normal', margin: 0, paddingLeft: 18 }}>
          <li>Anything in “What moved” you didn't expect?</li>
          <li>Are the goals still the right goals — and the right amounts?</li>
          <li>Anything big coming up next month? <Link to="/forecast" style={{ color: 'var(--accent)' }}>Check the forecast →</Link></li>
        </ul>
      </div>
    </div>
  )
}

function PersonCard({ name, avatarName, isMe, recap, cat }: {
  name: string
  avatarName: string
  isMe: boolean
  recap: PersonRecap
  cat: (id: string | null) => { icon: string; name: string } | undefined
}) {
  return (
    <div className="card">
      <div className="row" style={{ marginBottom: 10 }}>
        <PersonAvatar name={avatarName} isMe={isMe} size={28} />
        <strong>{name}</strong>
      </div>
      <div className="row--between" style={{ fontSize: '0.88rem' }}>
        <span className="muted">In</span><span className="amount amount--pos">{formatAUD(recap.income)}</span>
      </div>
      <div className="row--between" style={{ fontSize: '0.88rem' }}>
        <span className="muted">Out</span>
        <span className="amount">{formatAUD(recap.spend)} <span className={`txn__sub ${recap.spendDelta > 0 ? 'warn' : ''}`}>{recap.spendDelta >= 0 ? '▲' : '▼'} {formatAUD(Math.abs(recap.spendDelta))}</span></span>
      </div>
      {recap.topCategories.length > 0 && (
        <p className="txn__sub" style={{ whiteSpace: 'normal' }}>
          Most went on {recap.topCategories.map((c) => `${cat(c.categoryId)?.icon ?? ''} ${cat(c.categoryId)?.name ?? 'Uncategorised'} ${formatAUD(c.total)}`).join(', ')}.
        </p>
      )}
      {recap.movers.length > 0 && (
        <>
          <div className="txn__sub" style={{ fontWeight: 700, marginTop: 6 }}>What moved</div>
          {recap.movers.map((c) => (
            <div key={c.categoryId ?? 'none'} className="row--between" style={{ fontSize: '0.85rem' }}>
              <span>{cat(c.categoryId)?.icon} {cat(c.categoryId)?.name ?? 'Uncategorised'}</span>
              <span className={c.delta > 0 ? 'warn' : 'amount--pos'}>{c.delta > 0 ? '▲' : '▼'} {formatAUD(Math.abs(c.delta))}</span>
            </div>
          ))}
        </>
      )}
      {recap.biggest && (
        <p className="txn__sub" style={{ whiteSpace: 'normal' }}>
          Biggest spend: {recap.biggest.description} {formatAUD(recap.biggest.amount)} on {formatDayMonth(recap.biggest.date)}.
        </p>
      )}
    </div>
  )
}
