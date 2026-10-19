import { useState } from 'react'
import { addGoal, deleteGoal, updateGoal } from '../data/goals'
import type { Goal } from '../data/types'

const ICONS = ['🎯', '✈️', '🏠', '🚗', '💍', '🎓', '🛟', '🎁', '🐶', '💻']

/** Add / edit a savings goal, or put money towards one. Joint goals are visible to and fundable by both. */
export function GoalSheet({ goal, ownerId, onClose, onSaved }: { goal: Goal | null; ownerId: string; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(goal?.name ?? '')
  const [icon, setIcon] = useState(goal?.icon ?? ICONS[0])
  const [target, setTarget] = useState(goal ? String(goal.target_amount) : '')
  const [date, setDate] = useState(goal?.target_date ?? '')
  const [joint, setJoint] = useState(goal ? goal.owner_id === null : false)
  const [contribution, setContribution] = useState('')
  const [busy, setBusy] = useState(false)

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    try {
      await fn()
      onSaved()
    } finally {
      setBusy(false)
    }
  }

  const save = () => {
    const value = Number(target)
    if (!name.trim() || !Number.isFinite(value) || value <= 0) return
    const payload = { name: name.trim(), icon, target_amount: value, target_date: date || null, owner_id: joint ? null : ownerId }
    void run(() => (goal ? updateGoal(goal.id, payload) : addGoal(payload)))
  }

  const contribute = (sign: 1 | -1) => {
    const value = Number(contribution)
    if (!goal || !Number.isFinite(value) || value <= 0) return
    void run(() => updateGoal(goal.id, { saved_amount: Math.max(0, Math.round((goal.saved_amount + sign * value) * 100) / 100) }))
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <h2>{goal ? `${goal.icon} ${goal.name}` : 'New goal'}</h2>
        {goal && (
          <div className="card" style={{ margin: 0 }}>
            <label className="muted">Put money towards it (or take some back)</label>
            <div className="row">
              <input className="input" type="number" inputMode="decimal" placeholder="Amount" value={contribution} onChange={(e) => setContribution(e.target.value)} />
              <button className="btn btn--primary" disabled={busy} onClick={() => contribute(1)}>Add</button>
              <button className="btn" disabled={busy} onClick={() => contribute(-1)}>Take</button>
            </div>
          </div>
        )}
        <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
          {ICONS.map((i) => (
            <button key={i} className={`chip${i === icon ? ' chip--confirmed' : ''}`} style={i === icon ? { borderColor: 'var(--accent)' } : undefined} onClick={() => setIcon(i)} aria-label={`Icon ${i}`}>{i}</button>
          ))}
        </div>
        <input className="input" placeholder='Name, e.g. "Japan trip"' value={name} onChange={(e) => setName(e.target.value)} />
        <input className="input" type="number" inputMode="decimal" placeholder="Target amount" value={target} onChange={(e) => setTarget(e.target.value)} />
        <label className="muted">Target date (optional)</label>
        <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <label className="row"><input type="checkbox" checked={joint} onChange={(e) => setJoint(e.target.checked)} /> Joint goal (you both save towards it)</label>
        <div className="row">
          <button className="btn btn--primary" disabled={busy} onClick={save}>Save</button>
          {goal && <button className="btn" disabled={busy} onClick={() => void run(() => updateGoal(goal.id, { is_archived: true }))}>Archive</button>}
          {goal && <button className="btn" style={{ color: 'var(--danger)' }} disabled={busy} onClick={() => void run(() => deleteGoal(goal.id))}>Delete</button>}
        </div>
      </div>
    </div>
  )
}
