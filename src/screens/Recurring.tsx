import { useCallback, useEffect, useState } from 'react'
import { fetchSubscriptions, setStatus, syncSubscriptions } from '../data/subscriptions'
import { addBill, deleteBill, fetchBills, updateBill } from '../data/bills'
import { fetchTransactions } from '../data/transactions'
import { useAuth } from '../auth/AuthProvider'
import { useData } from '../data/DataProvider'
import { useRealtime } from '../data/useRealtime'
import { advanceDue, suggestMatch } from '../domain/billing'
import { normaliseCadence } from '../domain/cadence'
import { addDaysIso, formatAUD, formatDayMonth, isoToday } from '../domain/money'
import { SegmentedControl } from '../components/ui/SegmentedControl'
import { EmptyState } from '../components/ui/EmptyState'
import type { Bill, BillFrequency, Subscription } from '../data/types'

type View = 'weekly' | 'monthly' | 'yearly'
const SUFFIX: Record<View, string> = { weekly: '/wk', monthly: '/mo', yearly: '/yr' }

export default function Recurring() {
  const { user } = useAuth()
  const [subs, setSubs] = useState<Subscription[]>([])
  const [bills, setBills] = useState<Bill[]>([])
  const [view, setView] = useState<View>('monthly')
  const [editing, setEditing] = useState<Bill | 'new' | null>(null)
  const [note, setNote] = useState('')

  const load = useCallback(() => {
    fetchSubscriptions().then(setSubs).catch(() => setSubs([]))
    fetchBills().then(setBills).catch(() => setBills([]))
  }, [])
  useEffect(load, [load])
  useRealtime(['budget_subscriptions', 'budget_bills'], load)

  const candidates = subs.filter((s) => s.status === 'candidate')
  const confirmed = subs.filter((s) => s.status === 'confirmed')
  const total = confirmed.reduce((sum, s) => sum + normaliseCadence(s.amount, s.cadence)[view], 0)
  const at = (s: Subscription) => normaliseCadence(s.amount, s.cadence)[view]

  const act = async (id: string, status: 'confirmed' | 'dismissed' | 'cancelled') => {
    await setStatus(id, status)
    load()
  }

  const markPaid = async (bill: Bill) => {
    const txns = await fetchTransactions(addDaysIso(bill.next_due, -10), addDaysIso(bill.next_due, 10))
    const match = suggestMatch(bill, txns)
    await updateBill(bill.id, { last_paid: isoToday(), next_due: advanceDue(bill.next_due, bill.frequency, bill.due_day) })
    setNote(match ? `Matched "${match.description}" ${formatAUD(match.amount)} on ${formatDayMonth(match.txn_date)}.` : '')
    load()
  }

  const soon = bills.filter((b) => b.next_due <= addDaysIso(isoToday(), 7))
  const overdue = (b: Bill) => b.next_due < isoToday()

  return (
    <div className="screen">
      <div className="row--between">
        <h1 className="brand">Recurring</h1>
        {user && <button className="btn btn--small" onClick={() => void syncSubscriptions(user.id).then(load)}>Re-scan</button>}
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
          <h2>Subscriptions</h2>
          <SegmentedControl options={[{ value: 'weekly', label: '$/wk' }, { value: 'monthly', label: '$/mo' }, { value: 'yearly', label: '$/yr' }]} value={view} onChange={setView} />
        </div>
        <div className="row--between" style={{ margin: '8px 0' }}>
          <span className="muted">Total</span>
          <span className="stat--small">{formatAUD(total)}{SUFFIX[view]}</span>
        </div>
        {confirmed.map((s) => {
          const first = s.price_history[0]?.amount
          const crept = first !== undefined && s.amount > first
          return (
            <div key={s.id} className="txn">
              <div className="txn__main">
                <div className="txn__desc">{s.name}</div>
                <div className="txn__sub">bills as {formatAUD(s.amount)} {s.cadence} · next ~{s.next_expected ? formatDayMonth(s.next_expected) : '?'}</div>
                {crept && <div className="txn__sub"><span className="badge badge--dup">was {formatAUD(first)}</span></div>}
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

      <div className="card">
        <div className="row--between">
          <h2>Bills</h2>
          <button className="btn btn--small" onClick={() => setEditing('new')}>+ Add</button>
        </div>
        {note && <p className="txn__sub" style={{ whiteSpace: 'normal' }}>✅ {note}</p>}
        {soon.length > 0 && (
          <p className="txn__sub" style={{ whiteSpace: 'normal' }}>
            Next 7 days: {soon.map((b) => `${b.name} (${formatDayMonth(b.next_due)})`).join(' · ')}
          </p>
        )}
        {bills.map((b) => (
          <div key={b.id} className="txn">
            <div className="txn__main">
              <div className="txn__desc">{b.name} {b.autopay && <span className="badge">autopay</span>}</div>
              <div className="txn__sub">
                {formatAUD(b.amount)}{b.is_estimate ? ' (est.)' : ''} · {b.frequency} ·{' '}
                <span className={overdue(b) ? 'error' : ''}>due {formatDayMonth(b.next_due)}</span>
              </div>
            </div>
            <button className="btn btn--small" onClick={() => setEditing(b)}>Edit</button>
            <button className="btn btn--small btn--primary" onClick={() => void markPaid(b)}>Paid</button>
          </div>
        ))}
        {bills.length === 0 && <EmptyState icon="📅" title="No bills yet" hint="Add recurring bills to get Discord reminders at 8:05am." />}
      </div>

      {editing && (
        <BillSheet bill={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load() }} />
      )}
    </div>
  )
}

function BillSheet({ bill, onClose, onSaved }: { bill: Bill | null; onClose: () => void; onSaved: () => void }) {
  const { categories } = useData()
  const [name, setName] = useState(bill?.name ?? '')
  const [amount, setAmount] = useState(bill ? String(bill.amount) : '')
  const [isEstimate, setIsEstimate] = useState(bill?.is_estimate ?? false)
  const [frequency, setFrequency] = useState<BillFrequency>(bill?.frequency ?? 'monthly')
  const [nextDue, setNextDue] = useState(bill?.next_due ?? isoToday())
  const [autopay, setAutopay] = useState(bill?.autopay ?? false)
  const [categoryId, setCategoryId] = useState(bill?.category_id ?? '')

  const save = async () => {
    const value = Number(amount)
    if (!name.trim() || !Number.isFinite(value) || value <= 0) return
    const payload = {
      name: name.trim(), amount: value, is_estimate: isEstimate, frequency,
      due_day: Number(nextDue.slice(8, 10)), next_due: nextDue, autopay,
      category_id: categoryId || null,
    }
    if (bill) await updateBill(bill.id, payload)
    else await addBill(payload)
    onSaved()
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <h2>{bill ? 'Edit bill' : 'New bill'}</h2>
        <input className="input" placeholder="Name (e.g. Electricity)" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="input" type="number" inputMode="decimal" placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <label className="row"><input type="checkbox" checked={isEstimate} onChange={(e) => setIsEstimate(e.target.checked)} /> Amount is an estimate</label>
        <select className="input" value={frequency} onChange={(e) => setFrequency(e.target.value as BillFrequency)}>
          <option value="monthly">Monthly</option>
          <option value="quarterly">Quarterly</option>
          <option value="annual">Annual</option>
        </select>
        <label className="muted">Next due</label>
        <input className="input" type="date" value={nextDue} onChange={(e) => setNextDue(e.target.value)} />
        <label className="row"><input type="checkbox" checked={autopay} onChange={(e) => setAutopay(e.target.checked)} /> Autopay (direct debit)</label>
        <select className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">Category (optional)</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
          ))}
        </select>
        <div className="row">
          <button className="btn btn--primary" onClick={() => void save()}>Save</button>
          {bill && <button className="btn" onClick={() => void deleteBill(bill.id).then(onSaved)}>Delete</button>}
        </div>
      </div>
    </div>
  )
}
