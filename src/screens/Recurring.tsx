import { useCallback, useEffect, useMemo, useState } from 'react'
import { useData } from '../data/DataProvider'
import { fetchBills, updateBill } from '../data/bills'
import { fetchSubscriptions, setStatus } from '../data/subscriptions'
import { fetchTransactions } from '../data/transactions'
import { useRealtime } from '../data/useRealtime'
import { visibleTo } from '../domain/ownership'
import { buildRecurring, countdown, dueBetween } from '../domain/recurring'
import type { RecurringItem } from '../domain/recurring'
import { advanceDue, suggestMatch } from '../domain/billing'
import { addDaysIso, formatAUD, formatDayMonth, isoToday } from '../domain/money'
import { BillSheet } from '../components/BillSheet'
import { PersonSwitcher } from '../components/PersonSwitcher'
import { SegmentedControl } from '../components/ui/SegmentedControl'
import { EmptyState } from '../components/ui/EmptyState'
import type { Bill, Subscription } from '../data/types'

type View = 'weekly' | 'monthly' | 'yearly'
const SUFFIX: Record<View, string> = { weekly: '/wk', monthly: '/mo', yearly: '/yr' }
const FROM_MONTHLY: Record<View, number> = { weekly: 12 / 52, monthly: 1, yearly: 12 }

function monthEnd(iso: string): string {
  const [y, m] = iso.split('-').map(Number)
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return `${iso.slice(0, 7)}-${String(last).padStart(2, '0')}`
}

/**
 * Everything that comes out on a schedule — hand-added bills and the
 * subscriptions Tally detects — in one list, soonest first.
 */
export default function Recurring() {
  const { viewId, readOnly } = useData()
  const [bills, setBills] = useState<Bill[]>([])
  const [subs, setSubs] = useState<Subscription[]>([])
  const [view, setView] = useState<View>('monthly')
  const [editing, setEditing] = useState<Bill | 'new' | null>(null)
  const [subDetail, setSubDetail] = useState<Subscription | null>(null)
  const [note, setNote] = useState('')

  const load = useCallback(() => {
    if (!viewId) return
    fetchBills().then((b) => setBills(visibleTo(b, viewId))).catch(() => setBills([]))
    fetchSubscriptions().then((s) => setSubs(s.filter((x) => x.owner_id === viewId))).catch(() => setSubs([]))
  }, [viewId])
  useEffect(load, [load])
  useRealtime(['budget_bills', 'budget_subscriptions'], load)

  const today = isoToday()
  const items = useMemo(() => buildRecurring(bills, subs), [bills, subs])
  const candidates = subs.filter((s) => s.status === 'candidate')
  const total = items.reduce((s, i) => s + i.monthly, 0) * FROM_MONTHLY[view]
  const thisMonth = dueBetween(items, '0000-01-01', monthEnd(today)) // includes overdue
  const thisMonthTotal = thisMonth.reduce((s, i) => s + i.amount, 0)
  const recentlyPaid = bills.filter((b) => b.last_paid).sort((a, b) => (b.last_paid ?? '').localeCompare(a.last_paid ?? '')).slice(0, 4)

  const markPaid = async (bill: Bill) => {
    // a joint bill could have come out of either person's account
    const txns = await fetchTransactions(addDaysIso(bill.next_due, -10), addDaysIso(bill.next_due, 10), bill.owner_id ?? undefined)
    const match = suggestMatch(bill, txns)
    await updateBill(bill.id, { last_paid: today, next_due: advanceDue(bill.next_due, bill.frequency, bill.due_day) })
    setNote(match ? `${bill.name} paid — matched "${match.description}" ${formatAUD(match.amount)} on ${formatDayMonth(match.txn_date)}.` : `${bill.name} marked paid.`)
    load()
  }

  const actOnSub = async (id: string, status: 'confirmed' | 'dismissed' | 'cancelled') => {
    await setStatus(id, status)
    setSubDetail(null)
    load()
  }

  const openItem = (i: RecurringItem) => {
    if (readOnly) return
    if (i.kind === 'bill') setEditing(i.bill)
    else setSubDetail(i.sub)
  }
  // Subscription detection runs automatically after every statement import.

  return (
    <div className="screen">
      <div className="row--between">
        <h1 className="brand">Recurring</h1>
        <div className="row" style={{ gap: 8 }}>
          <PersonSwitcher />
          {!readOnly && <button className="btn btn--small" onClick={() => setEditing('new')}>+ Add</button>}
        </div>
      </div>

      <div className="hero" style={{ cursor: 'default' }}>
        <div className="hero__label">Committed · {view}</div>
        <div className="stat">{formatAUD(total)}<span style={{ fontSize: '1rem', color: 'var(--dim)' }}>{SUFFIX[view]}</span></div>
        <div className="txn__sub">{formatAUD(thisMonthTotal)} still to come out this month · {thisMonth.length} item{thisMonth.length === 1 ? '' : 's'}</div>
        <div style={{ marginTop: 12 }}>
          <SegmentedControl options={[{ value: 'weekly', label: '$/wk' }, { value: 'monthly', label: '$/mo' }, { value: 'yearly', label: '$/yr' }]} value={view} onChange={setView} />
        </div>
      </div>

      {note && <p className="txn__sub" style={{ whiteSpace: 'normal' }}>✅ {note}</p>}

      {!readOnly && candidates.length > 0 && (
        <div className="card card--tint">
          <h2>Spotted in your statements <span className="badge">best guess</span></h2>
          {candidates.map((s) => (
            <div key={s.id} className="txn">
              <div className="txn__main">
                <div className="txn__desc">{s.name}</div>
                <div className="txn__sub">{formatAUD(s.amount)} {s.cadence} · next ~{s.next_expected ? formatDayMonth(s.next_expected) : '?'}</div>
              </div>
              <button className="btn btn--small btn--primary" onClick={() => void actOnSub(s.id, 'confirmed')}>Track</button>
              <button className="btn btn--small" onClick={() => void actOnSub(s.id, 'dismissed')}>No</button>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <h2>Upcoming</h2>
        {items.map((i) => {
          const overdue = i.next !== null && i.next < today
          const first = i.kind === 'sub' ? i.sub.price_history[0]?.amount : undefined
          const crept = first !== undefined && i.amount > first
          const cadence = i.kind === 'bill' ? i.bill.frequency : i.sub.cadence
          return (
            <div key={`${i.kind}-${i.id}`} className="txn">
              <button className="txn__main" style={{ background: 'none', border: 0, color: 'inherit', textAlign: 'left', padding: 0, cursor: readOnly ? 'default' : 'pointer', font: 'inherit' }} onClick={() => openItem(i)}>
                <div className="txn__desc">
                  {i.name}
                  {i.joint && <> <span className="badge">Joint</span></>}
                  {i.kind === 'sub' && <> <span className="badge">detected</span></>}
                </div>
                <div className="txn__sub">
                  {formatAUD(i.amount)}{i.kind === 'bill' && i.bill.is_estimate ? ' (est.)' : ''} · {cadence}
                  {i.next && <> · <span className={overdue ? 'error' : ''}>{countdown(i.next, today)}</span></>}
                  {i.kind === 'bill' && i.bill.autopay ? ' · auto' : ''}
                </div>
                {crept && <div className="txn__sub"><span className="badge badge--dup">↑ was {formatAUD(first)}</span></div>}
              </button>
              {!readOnly && i.kind === 'bill' && !i.bill.autopay && (
                <button className="btn btn--small btn--primary" onClick={() => void markPaid(i.bill)}>Paid</button>
              )}
              {(readOnly || i.kind === 'sub' || i.bill.autopay) && (
                <span className="amount">{formatAUD(i.monthly * FROM_MONTHLY[view])}{SUFFIX[view]}</span>
              )}
            </div>
          )
        })}
        {items.length === 0 && (
          <EmptyState
            icon="🔁"
            title="Nothing recurring yet"
            hint={readOnly ? undefined : 'Add bills like rent or power by hand — subscriptions appear automatically after you import statements.'}
          />
        )}
      </div>

      {recentlyPaid.length > 0 && (
        <div className="card">
          <h2>Recently paid</h2>
          {recentlyPaid.map((b) => (
            <div key={b.id} className="row--between" style={{ fontSize: '0.85rem', marginBottom: 6 }}>
              <span>{b.name}</span>
              <span className="muted">paid {b.last_paid ? formatDayMonth(b.last_paid) : ''}</span>
            </div>
          ))}
        </div>
      )}

      {editing && !readOnly && (
        <BillSheet bill={editing === 'new' ? null : editing} ownerId={viewId} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load() }} />
      )}

      {subDetail && (
        <div className="sheet-backdrop" onClick={() => setSubDetail(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <h2>{subDetail.name}</h2>
            <p className="txn__sub" style={{ whiteSpace: 'normal' }}>
              Detected from your statements · {formatAUD(subDetail.amount)} {subDetail.cadence}
              {subDetail.next_expected ? ` · next ~${formatDayMonth(subDetail.next_expected)}` : ''}
            </p>
            {subDetail.price_history.length > 1 && (
              <p className="txn__sub" style={{ whiteSpace: 'normal' }}>
                Price history: {subDetail.price_history.map((h) => `${formatAUD(h.amount)} (${formatDayMonth(h.date)})`).join(' → ')}
              </p>
            )}
            <button className="btn" onClick={() => void actOnSub(subDetail.id, 'cancelled')}>I’ve cancelled it</button>
            <button className="btn" onClick={() => void actOnSub(subDetail.id, 'dismissed')}>Not a subscription</button>
          </div>
        </div>
      )}
    </div>
  )
}
