import { useCallback, useEffect, useState } from 'react'
import { useData } from '../data/DataProvider'
import { addBill, deleteBill, fetchBills, updateBill } from '../data/bills'
import { fetchTransactions } from '../data/transactions'
import { useRealtime } from '../data/useRealtime'
import { advanceDue, suggestMatch } from '../domain/billing'
import { addDaysIso, formatAUD, isoToday } from '../domain/money'
import type { Bill, BillFrequency } from '../data/types'

export default function Bills() {
  const [bills, setBills] = useState<Bill[]>([])
  const [editing, setEditing] = useState<Bill | 'new' | null>(null)
  const [note, setNote] = useState('')
  const load = useCallback(() => {
    fetchBills().then(setBills).catch(() => setBills([]))
  }, [])
  useEffect(load, [load])
  useRealtime(['budget_bills'], load)

  const markPaid = async (bill: Bill) => {
    const txns = await fetchTransactions(addDaysIso(bill.next_due, -10), addDaysIso(bill.next_due, 10))
    const match = suggestMatch(bill, txns)
    await updateBill(bill.id, {
      last_paid: isoToday(),
      next_due: advanceDue(bill.next_due, bill.frequency, bill.due_day),
    })
    setNote(match ? `Matched "${match.description}" ${formatAUD(match.amount)} on ${match.txn_date}.` : '')
    load()
  }

  const overdue = (b: Bill) => b.next_due < isoToday()

  return (
    <div className="screen">
      <div className="row--between">
        <h1 className="brand">Bills</h1>
        <button className="btn btn--small" onClick={() => setEditing('new')}>+ Add</button>
      </div>
      {note && <p className="muted">✅ {note}</p>}
      <ul className="list-plain">
        {bills.map((b) => (
          <li key={b.id} className="txn">
            <div className="txn__main">
              <div className="txn__desc">{b.name} {b.autopay && <span className="badge">autopay</span>}</div>
              <div className="txn__sub">
                {formatAUD(b.amount)}{b.is_estimate ? ' (est.)' : ''} · {b.frequency} ·{' '}
                <span className={overdue(b) ? 'error' : ''}>due {b.next_due}</span>
              </div>
            </div>
            <button className="btn btn--small" onClick={() => setEditing(b)}>Edit</button>
            <button className="btn btn--small btn--primary" onClick={() => void markPaid(b)}>Paid</button>
          </li>
        ))}
        {bills.length === 0 && <p className="muted">No bills yet — add your recurring bills to get Discord reminders.</p>}
      </ul>
      {editing && (
        <BillSheet
          bill={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load() }}
        />
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
      name: name.trim(),
      amount: value,
      is_estimate: isEstimate,
      frequency,
      due_day: Number(nextDue.slice(8, 10)),
      next_due: nextDue,
      autopay,
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
