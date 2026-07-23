import { useCallback, useEffect, useMemo, useState } from 'react'
import { addBill, deleteBill, fetchBills, updateBill } from '../data/bills'
import { fetchTransactions } from '../data/transactions'
import { useData } from '../data/DataProvider'
import { useRealtime } from '../data/useRealtime'
import { advanceDue, suggestMatch } from '../domain/billing'
import { addDaysIso, formatAUD, formatDayMonth, isoToday } from '../domain/money'
import { EmptyState } from '../components/ui/EmptyState'
import { Toggle } from '../components/ui/Toggle'
import type { Bill, BillFrequency } from '../data/types'

function daysUntil(iso: string): number {
  return Math.round((Date.parse(iso) - Date.parse(isoToday())) / 86_400_000)
}
function countdown(iso: string): string {
  const d = daysUntil(iso)
  if (d < 0) return `${-d}d overdue`
  if (d === 0) return 'due today'
  if (d === 1) return 'tomorrow'
  return `in ${d}d`
}

export default function Bills() {
  const [bills, setBills] = useState<Bill[]>([])
  const [editing, setEditing] = useState<Bill | 'new' | null>(null)
  const [note, setNote] = useState('')

  const load = useCallback(() => {
    fetchBills().then(setBills).catch(() => setBills([]))
  }, [])
  useEffect(load, [load])
  useRealtime(['budget_bills'], load)

  const monthEnd = useMemo(() => {
    const [y, m] = isoToday().split('-').map(Number)
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
    return `${isoToday().slice(0, 7)}-${String(last).padStart(2, '0')}`
  }, [])
  const dueThisMonth = bills.filter((b) => b.next_due <= monthEnd)
  const dueTotal = dueThisMonth.reduce((s, b) => s + b.amount, 0)
  const overdue = (b: Bill) => b.next_due < isoToday()
  const upcoming = [...bills].sort((a, b) => a.next_due.localeCompare(b.next_due))
  const recentlyPaid = bills.filter((b) => b.last_paid).sort((a, b) => (b.last_paid ?? '').localeCompare(a.last_paid ?? '')).slice(0, 4)

  // Optimistic autopay flip — UI springs immediately, DB catches up.
  const toggleAutopay = async (bill: Bill) => {
    const next = !bill.autopay
    setBills((prev) => prev.map((b) => (b.id === bill.id ? { ...b, autopay: next } : b)))
    try {
      await updateBill(bill.id, { autopay: next })
    } catch {
      setBills((prev) => prev.map((b) => (b.id === bill.id ? { ...b, autopay: bill.autopay } : b)))
    }
  }

  const markPaid = async (bill: Bill) => {
    const txns = await fetchTransactions(addDaysIso(bill.next_due, -10), addDaysIso(bill.next_due, 10))
    const match = suggestMatch(bill, txns)
    await updateBill(bill.id, { last_paid: isoToday(), next_due: advanceDue(bill.next_due, bill.frequency, bill.due_day) })
    setNote(match ? `Matched "${match.description}" ${formatAUD(match.amount)} on ${formatDayMonth(match.txn_date)}.` : '')
    load()
  }

  return (
    <div className="screen">
      <div className="row--between">
        <h1 className="brand">Bills</h1>
        <button className="btn btn--small" onClick={() => setEditing('new')}>+ Add</button>
      </div>

      <div className="hero" style={{ cursor: 'default' }}>
        <div className="hero__label">Due this month</div>
        <div className="stat">{formatAUD(dueTotal)}</div>
        <div className="txn__sub">{dueThisMonth.length} bill{dueThisMonth.length === 1 ? '' : 's'} · {dueThisMonth.filter((b) => b.autopay).length} on autopay</div>
      </div>

      {note && <p className="txn__sub" style={{ whiteSpace: 'normal' }}>✅ {note}</p>}

      <div className="card">
        <h2>Upcoming</h2>
        {upcoming.map((b) => (
          <div key={b.id} className="txn">
            <div className="txn__main">
              <div className="txn__desc">{b.name}</div>
              <div className="txn__sub">
                {formatAUD(b.amount)}{b.is_estimate ? ' (est.)' : ''} · {b.frequency} ·{' '}
                <span className={overdue(b) ? 'error' : ''}>{countdown(b.next_due)}</span>
              </div>
            </div>
            <div className="txn__side">
              <div className="row" style={{ gap: 6 }}>
                <span className="txn__sub">auto</span>
                <Toggle on={b.autopay} onChange={() => void toggleAutopay(b)} label={`Autopay ${b.name}`} />
              </div>
              {!b.autopay && <button className="btn btn--small btn--primary" onClick={() => void markPaid(b)}>Paid</button>}
            </div>
          </div>
        ))}
        {bills.length === 0 && <EmptyState icon="📅" title="No bills yet" hint="Add recurring bills to get Discord reminders at 8:05am." />}
      </div>

      {recentlyPaid.length > 0 && (
        <div className="card">
          <h2>Recently paid</h2>
          {recentlyPaid.map((b) => (
            <div key={b.id} className="txn">
              <div className="txn__main">
                <div className="txn__desc">{b.name}</div>
                <div className="txn__sub">paid {b.last_paid ? formatDayMonth(b.last_paid) : ''}</div>
              </div>
              <button className="btn btn--small" onClick={() => setEditing(b)}>Edit</button>
            </div>
          ))}
        </div>
      )}

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
