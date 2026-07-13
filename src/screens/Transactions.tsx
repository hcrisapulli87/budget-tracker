import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { useData } from '../data/DataProvider'
import { fetchTransactions, insertTransactions } from '../data/transactions'
import { applyCorrection } from '../data/rules'
import { useRealtime } from '../data/useRealtime'
import { formatAUD, isoToday } from '../domain/money'
import { normaliseMerchant } from '../domain/merchant'
import { CategoryPicker } from '../components/CategoryPicker'
import type { Txn } from '../data/types'

function monthLabel(iso: string): string {
  return new Date(`${iso}-01T00:00:00`).toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })
}
function shiftMonth(iso: string, delta: number): string {
  const [y, m] = iso.split('-').map(Number)
  const t = y * 12 + (m - 1) + delta
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`
}
function monthBounds(iso: string): { from: string; to: string } {
  const [y, m] = iso.split('-').map(Number)
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return { from: `${iso}-01`, to: `${iso}-${String(last).padStart(2, '0')}` }
}

export default function Transactions() {
  const { user } = useAuth()
  const { categories, profiles, reload } = useData()
  const [month, setMonth] = useState(() => isoToday().slice(0, 7))
  const [txns, setTxns] = useState<Txn[]>([])
  const [who, setWho] = useState<'all' | 'mine'>('all')
  const [catFilter, setCatFilter] = useState('')
  const [search, setSearch] = useState('')
  const [picking, setPicking] = useState<Txn | null>(null)
  const [adding, setAdding] = useState(false)

  const load = useCallback(() => {
    const { from, to } = monthBounds(month)
    fetchTransactions(from, to).then(setTxns).catch(() => setTxns([]))
  }, [month])

  useEffect(load, [load])
  useRealtime(['budget_transactions'], load)

  const visible = useMemo(
    () =>
      txns.filter(
        (t) =>
          (who === 'all' || t.owner_id === user?.id) &&
          (!catFilter || t.category_id === catFilter) &&
          (!search || t.description.toLowerCase().includes(search.toLowerCase())),
      ),
    [txns, who, catFilter, search, user],
  )

  const cat = (id: string | null) => categories.find((c) => c.id === id)
  const owner = (id: string) => profiles.find((p) => p.id === id)?.display_name ?? '?'

  const pick = async (categoryId: string) => {
    if (!picking) return
    await applyCorrection(picking, categoryId)
    setPicking(null)
    await reload() // rules changed
    load()
  }

  return (
    <div className="screen">
      <div className="row--between">
        <h1 className="brand">Activity</h1>
        <button className="btn btn--small" onClick={() => setAdding(true)}>+ Add</button>
      </div>
      <div className="row--between card">
        <button className="btn btn--small" onClick={() => setMonth(shiftMonth(month, -1))}>‹</button>
        <strong>{monthLabel(month)}</strong>
        <button className="btn btn--small" onClick={() => setMonth(shiftMonth(month, 1))}>›</button>
      </div>
      <div className="row">
        <select className="input" value={who} onChange={(e) => setWho(e.target.value as 'all' | 'mine')}>
          <option value="all">Both of us</option>
          <option value="mine">Just me</option>
        </select>
        <select className="input" value={catFilter} onChange={(e) => setCatFilter(e.target.value)}>
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
          ))}
        </select>
      </div>
      <input className="input" placeholder="Search descriptions…" value={search} onChange={(e) => setSearch(e.target.value)} />

      <ul className="list-plain">
        {visible.map((t) => (
          <li key={t.id} className="txn">
            <div className="txn__main">
              <div className="txn__desc">{t.description}</div>
              <div className="txn__sub">{t.txn_date} · {owner(t.owner_id)} · {t.account}</div>
            </div>
            <button
              className={`chip${t.category_confirmed ? ' chip--confirmed' : ''}`}
              title={t.category_confirmed ? 'Confirmed' : 'Best guess — tap to correct'}
              onClick={() => setPicking(t)}
            >
              {cat(t.category_id) ? `${cat(t.category_id)!.icon} ${cat(t.category_id)!.name}` : '＋ categorise'}
            </button>
            <span className={`amount ${t.amount < 0 ? 'amount--neg' : 'amount--pos'}`}>{formatAUD(t.amount)}</span>
          </li>
        ))}
        {visible.length === 0 && <p className="muted">No transactions for this view — import a CSV to get started.</p>}
      </ul>

      {picking && <CategoryPicker categories={categories} onPick={(id) => void pick(id)} onClose={() => setPicking(null)} />}
      {adding && user && (
        <ManualAdd
          onClose={() => setAdding(false)}
          onSaved={() => { setAdding(false); load() }}
          userId={user.id}
        />
      )}
    </div>
  )
}

function ManualAdd({ userId, onClose, onSaved }: { userId: string; onClose: () => void; onSaved: () => void }) {
  const { categories } = useData()
  const [date, setDate] = useState(isoToday())
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [busy, setBusy] = useState(false)

  const save = async () => {
    const value = Number(amount)
    if (!description.trim() || !Number.isFinite(value) || value === 0) return
    setBusy(true)
    await insertTransactions([{
      owner_id: userId,
      account: 'cash',
      txn_date: date,
      amount: -Math.abs(value),
      description: description.trim(),
      merchant_norm: normaliseMerchant(description),
      category_id: categoryId || null,
      category_confirmed: Boolean(categoryId),
      import_hash: `manual-${crypto.randomUUID()}`,
      source: 'manual' as const,
      import_id: null,
    }])
    onSaved()
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <h2>Add cash spend</h2>
        <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <input className="input" type="number" inputMode="decimal" placeholder="Amount (e.g. 12.50)" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <input className="input" placeholder="What was it?" value={description} onChange={(e) => setDescription(e.target.value)} />
        <select className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">Category (optional)</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
          ))}
        </select>
        <button className="btn btn--primary" disabled={busy} onClick={() => void save()}>Save</button>
      </div>
    </div>
  )
}
