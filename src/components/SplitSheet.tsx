import { useState } from 'react'
import { updateTransaction } from '../data/transactions'
import { useData } from '../data/DataProvider'
import { splitRemainder, validateSplits } from '../domain/splits'
import { formatAUD } from '../domain/money'
import type { Txn, TxnSplit } from '../data/types'

const PROBLEM_TEXT = {
  'too-few': 'A split needs at least two parts.',
  'zero-part': 'Every part needs an amount.',
  'wrong-sign': 'Parts must all be spend (or all income), like the transaction.',
  mismatch: 'Parts must add up to the whole amount.',
}

/** Split one transaction across categories (e.g. a Woolworths shop: groceries + household). */
export function SplitSheet({ txn, onClose, onSaved }: { txn: Txn; onClose: () => void; onSaved: () => void }) {
  const { categories } = useData()
  const sign = txn.amount < 0 ? -1 : 1
  const total = Math.abs(txn.amount)
  const [parts, setParts] = useState<{ category_id: string; amount: string }[]>(() =>
    txn.splits && txn.splits.length > 1
      ? txn.splits.map((s) => ({ category_id: s.category_id ?? '', amount: String(Math.abs(s.amount)) }))
      : [{ category_id: txn.category_id ?? '', amount: String(total) }, { category_id: '', amount: '' }],
  )
  const [busy, setBusy] = useState(false)

  const asSplits = (): TxnSplit[] => parts.map((p) => ({ category_id: p.category_id || null, amount: sign * (Number(p.amount) || 0) }))
  const splits = asSplits()
  const problem = validateSplits(txn.amount, splits)
  const left = Math.abs(splitRemainder(txn.amount, splits))

  const set = (i: number, patch: Partial<{ category_id: string; amount: string }>) =>
    setParts(parts.map((p, j) => (j === i ? { ...p, ...patch } : p)))

  const fillRemainder = (i: number) => {
    const others = parts.reduce((s, p, j) => (j === i ? s : s + (Number(p.amount) || 0)), 0)
    set(i, { amount: String(Math.max(0, Math.round((total - others) * 100) / 100)) })
  }

  const save = async () => {
    if (problem) return
    setBusy(true)
    try {
      // the biggest part becomes the transaction's headline category
      const main = [...splits].sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))[0]
      await updateTransaction(txn.id, { splits, category_id: main.category_id, category_confirmed: true })
      onSaved()
    } finally {
      setBusy(false)
    }
  }

  const unsplit = async () => {
    setBusy(true)
    try {
      await updateTransaction(txn.id, { splits: null })
      onSaved()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="sheet-backdrop" onClick={onClose} style={{ zIndex: 60 }}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <h2>Split {formatAUD(txn.amount)}</h2>
        <p className="txn__sub" style={{ whiteSpace: 'normal' }}>{txn.description}</p>
        {parts.map((p, i) => (
          <div key={i} className="row">
            <select className="input" value={p.category_id} onChange={(e) => set(i, { category_id: e.target.value })} aria-label={`Part ${i + 1} category`}>
              <option value="">Uncategorised</option>
              {categories.filter((c) => !c.is_archived).map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
            </select>
            <input className="input" type="number" inputMode="decimal" style={{ width: 96 }} placeholder="0.00" value={p.amount}
              onChange={(e) => set(i, { amount: e.target.value })} onFocus={() => !p.amount && fillRemainder(i)} aria-label={`Part ${i + 1} amount`} />
            {parts.length > 2 && <button className="btn btn--small" onClick={() => setParts(parts.filter((_, j) => j !== i))} aria-label="Remove part">✕</button>}
          </div>
        ))}
        <button className="btn" onClick={() => setParts([...parts, { category_id: '', amount: '' }])}>＋ Add part</button>
        <p className={`txn__sub ${problem ? 'warn' : ''}`} style={{ whiteSpace: 'normal' }}>
          {problem === 'mismatch' ? `${formatAUD(left)} left to allocate.` : problem ? PROBLEM_TEXT[problem] : 'Adds up ✓ — each part counts towards its own budget.'}
        </p>
        <div className="row">
          <button className="btn btn--primary" disabled={busy || !!problem} onClick={() => void save()}>Save split</button>
          {txn.splits && <button className="btn" disabled={busy} onClick={() => void unsplit()}>Remove split</button>}
        </div>
      </div>
    </div>
  )
}
