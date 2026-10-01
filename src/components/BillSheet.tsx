import { useState } from 'react'
import { addBill, deleteBill, updateBill } from '../data/bills'
import { useData } from '../data/DataProvider'
import { isoToday } from '../domain/money'
import type { Bill, BillFrequency } from '../data/types'

/** Add / edit a hand-entered recurring bill. New bills are yours unless marked joint. */
export function BillSheet({ bill, ownerId, onClose, onSaved }: { bill: Bill | null; ownerId: string; onClose: () => void; onSaved: () => void }) {
  const { categories } = useData()
  const [name, setName] = useState(bill?.name ?? '')
  const [amount, setAmount] = useState(bill ? String(bill.amount) : '')
  const [isEstimate, setIsEstimate] = useState(bill?.is_estimate ?? false)
  const [frequency, setFrequency] = useState<BillFrequency>(bill?.frequency ?? 'monthly')
  const [nextDue, setNextDue] = useState(bill?.next_due ?? isoToday())
  const [autopay, setAutopay] = useState(bill?.autopay ?? false)
  const [categoryId, setCategoryId] = useState(bill?.category_id ?? '')
  // new bills default to yours; existing joint bills stay joint unless claimed
  const [joint, setJoint] = useState(bill ? bill.owner_id === null : false)

  const save = async () => {
    const value = Number(amount)
    if (!name.trim() || !Number.isFinite(value) || value <= 0) return
    const payload = {
      name: name.trim(), amount: value, is_estimate: isEstimate, frequency,
      due_day: Number(nextDue.slice(8, 10)), next_due: nextDue, autopay,
      category_id: categoryId || null,
      owner_id: joint ? null : ownerId,
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
        <label className="row"><input type="checkbox" checked={joint} onChange={(e) => setJoint(e.target.checked)} /> Joint bill (shows for both of you)</label>
        <select className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">Category (optional)</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
          ))}
        </select>
        <p className="txn__sub" style={{ whiteSpace: 'normal' }}>The household Discord bot posts a reminder 3 days before each bill is due.</p>
        <div className="row">
          <button className="btn btn--primary" onClick={() => void save()}>Save</button>
          {bill && <button className="btn" onClick={() => void deleteBill(bill.id).then(onSaved)}>Delete</button>}
        </div>
      </div>
    </div>
  )
}
