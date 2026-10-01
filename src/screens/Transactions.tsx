import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useData } from '../data/DataProvider'
import { deleteTransaction, fetchByMerchant, fetchTransactions, searchTransactions, updateTransaction } from '../data/transactions'
import { applyCorrection, reapplyRules } from '../data/rules'
import { useRealtime } from '../data/useRealtime'
import { formatAUD, formatDayMonth, isoToday } from '../domain/money'
import { normaliseMerchant } from '../domain/merchant'
import { groupByDay } from '../domain/grouping'
import { CategoryPicker } from '../components/CategoryPicker'
import { IconCircle } from '../components/ui/IconCircle'
import { PersonSwitcher } from '../components/PersonSwitcher'
import { SegmentedControl } from '../components/ui/SegmentedControl'
import { EmptyState } from '../components/ui/EmptyState'
import { DEDUCTION_CATEGORIES } from '../domain/deductionCategories'
import type { AddPrefill } from './AddScreen'
import type { DeductionCategory, Txn } from '../data/types'

const REVIEW = '__review'

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
  const { categories, viewId, readOnly } = useData()
  const [month, setMonth] = useState(() => isoToday().slice(0, 7))
  const [txns, setTxns] = useState<Txn[]>([])
  // '' = all, a category id, or REVIEW for guesses still waiting on a tap
  const [params] = useSearchParams()
  const [catFilter, setCatFilter] = useState(params.get('review') ? REVIEW : '')
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<Txn[] | null>(null)
  const [detail, setDetail] = useState<Txn | null>(null)
  const [note, setNote] = useState('')

  const searching = search.trim().length >= 2

  const load = useCallback(() => {
    const { from, to } = monthBounds(month)
    if (!viewId) return
    fetchTransactions(from, to, viewId).then(setTxns).catch(() => setTxns([]))
  }, [month, viewId])
  useEffect(load, [load])
  useRealtime(['budget_transactions'], load)

  useEffect(() => {
    if (!searching) return setResults(null)
    const t = setTimeout(() => {
      searchTransactions(search.trim(), viewId).then(setResults).catch(() => setResults([]))
    }, 250)
    return () => clearTimeout(t)
  }, [search, searching, viewId])

  const source = searching ? (results ?? []) : txns
  const visible = useMemo(
    () =>
      source.filter(
        (t) => !catFilter || (catFilter === REVIEW ? !t.category_confirmed : t.category_id === catFilter),
      ),
    [source, catFilter],
  )
  const groups = useMemo(() => groupByDay(visible), [visible])

  const cat = (id: string | null) => categories.find((c) => c.id === id)

  // Confirm a best-guess category in place — the suggested chip animates out.
  const confirmGuess = async (t: Txn) => {
    await updateTransaction(t.id, { category_confirmed: true })
    load()
  }

  return (
    <div className="screen">
      <div className="row--between">
        <h1 className="brand">Activity</h1>
        <div className="row" style={{ gap: 8 }}>
          <PersonSwitcher />
          {!readOnly && (
            <>
              <Link to="/import" className="gear" aria-label="Import CSV">⤓</Link>
              <Link className="header-add" to="/add" aria-label="Add transaction">＋</Link>
            </>
          )}
        </div>
      </div>
      {note && <p className="txn__sub" style={{ whiteSpace: 'normal' }}>✨ {note}</p>}
      <input className="input" placeholder="Search everything…" value={search} onChange={(e) => setSearch(e.target.value)} />
      <div className="row" style={{ margin: '10px 0' }}>
        <select className="input" value={catFilter} onChange={(e) => setCatFilter(e.target.value)}>
          <option value="">All categories</option>
          <option value={REVIEW}>✨ Needs review</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
          ))}
        </select>
      </div>
      {!searching && (
        <div className="row--between card">
          <button className="btn btn--small btn--pager" onClick={() => setMonth(shiftMonth(month, -1))}>‹</button>
          <strong>{monthLabel(month)}</strong>
          <button className="btn btn--small btn--pager" onClick={() => setMonth(shiftMonth(month, 1))}>›</button>
        </div>
      )}
      {searching && <p className="txn__sub">All-time results for “{search.trim()}” — {visible.length} found</p>}

      {groups.map((g) => (
        <div key={g.dateIso}>
          <div className="day-head">
            <span>{formatDayMonth(g.dateIso)}</span>
            <span>{g.spend > 0 ? `-${formatAUD(g.spend).replace('-', '')}` : ''}</span>
          </div>
          <ul className="list-plain card" style={{ padding: '0 10px' }}>
            {g.txns.map((t) => (
              <li key={t.id}>
                <button className="txn txn--tap" onClick={() => setDetail(t)}>
                  <IconCircle icon={cat(t.category_id)?.icon ?? '❓'} colour={cat(t.category_id)?.colour ?? '#8ba59a'} />
                  <div className="txn__main">
                    <div className="txn__desc">{t.description}</div>
                    <div className="txn__sub">
                      {searching ? `${formatDayMonth(t.txn_date)} · ` : ''}{cat(t.category_id)?.name ?? 'Uncategorised'} · {t.account}
                    </div>
                  </div>
                  <span className={`amount ${t.amount < 0 ? 'amount--neg' : 'amount--pos'}`}>{formatAUD(t.amount)}</span>
                </button>
                {!readOnly && !t.category_confirmed && t.category_id && (
                  <div style={{ padding: '0 2px 10px' }}>
                    <button className="chip chip--suggest" onClick={() => void confirmGuess(t)}>
                      {cat(t.category_id)?.icon} {cat(t.category_id)?.name}? — tap to confirm
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
      {groups.length === 0 && (
        <EmptyState icon={catFilter === REVIEW ? '✅' : '🧾'} title={searching ? 'Nothing found' : catFilter === REVIEW ? 'All caught up this month' : 'No transactions yet'} hint={searching ? 'Try a different search.' : readOnly || catFilter === REVIEW ? undefined : 'Tap ＋ to add a spend, or import a CSV.'} />
      )}

      {detail && (
        <TxnSheet
          txn={detail}
          mine={!readOnly}
          onClose={() => setDetail(null)}
          onChanged={(msg) => { setDetail(null); load(); setNote(msg ?? ''); if (searching) setSearch('') }}
        />
      )}
    </div>
  )
}

function TxnSheet({ txn, mine, onClose, onChanged }: { txn: Txn; mine: boolean; onClose: () => void; onChanged: (note?: string) => void }) {
  const { categories, reload } = useData()
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)
  const [picking, setPicking] = useState(false)
  const [merchant, setMerchant] = useState<Txn[] | null>(null)
  const [date, setDate] = useState(txn.txn_date)
  const [amount, setAmount] = useState(String(Math.abs(txn.amount)))
  const [kind, setKind] = useState<'spend' | 'income'>(txn.amount < 0 ? 'spend' : 'income')
  const [description, setDescription] = useState(txn.description)
  const [account, setAccount] = useState(txn.account)
  const [note, setNote] = useState(txn.note)
  const [busy, setBusy] = useState(false)

  const cat = categories.find((c) => c.id === txn.category_id)

  const saveEdit = async () => {
    const value = Number(amount)
    if (!description.trim() || !Number.isFinite(value) || value <= 0) return
    setBusy(true)
    try {
      await updateTransaction(txn.id, {
        txn_date: date,
        amount: kind === 'spend' ? -Math.abs(value) : Math.abs(value),
        description: description.trim(),
        merchant_norm: normaliseMerchant(description),
        account: account.trim(),
        note: note.trim(),
      })
      onChanged()
    } finally {
      setBusy(false)
    }
  }

  const pickCategory = async (categoryId: string) => {
    await applyCorrection(txn, categoryId)
    // the new rule now categorises the rest of the backlog — no re-scan button
    const more = await reapplyRules(txn.owner_id).catch(() => 0)
    await reload()
    setPicking(false)
    onChanged(more > 0 ? `Learned from that — ${more} more transaction${more > 1 ? 's' : ''} categorised to match.` : undefined)
  }

  const toggleDeductible = async () => {
    setBusy(true)
    try {
      const next = !txn.deductible
      await updateTransaction(txn.id, { deductible: next, deduction_category: next ? (txn.deduction_category ?? 'other') : null })
      onChanged()
    } finally {
      setBusy(false)
    }
  }

  const changeDeductionCategory = async (category: DeductionCategory) => {
    await updateTransaction(txn.id, { deduction_category: category })
    onChanged()
  }

  const remove = async () => {
    setBusy(true)
    try {
      await deleteTransaction(txn.id)
      onChanged()
    } finally {
      setBusy(false)
    }
  }

  const addAgain = () => {
    const prefill: AddPrefill = {
      description: txn.description,
      amount: Math.abs(txn.amount),
      category_id: txn.category_id,
      account: txn.account,
      kind: txn.amount < 0 ? 'spend' : 'income',
    }
    navigate('/add', { state: prefill })
  }

  const showMerchant = () => {
    fetchByMerchant(txn.merchant_norm, txn.owner_id).then(setMerchant).catch(() => setMerchant([]))
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        {!editing ? (
          <>
            <div className="row--between">
              <h2>{txn.description}</h2>
              <span className={`amount ${txn.amount < 0 ? 'amount--neg' : 'amount--pos'}`}>{formatAUD(txn.amount)}</span>
            </div>
            <p className="txn__sub" style={{ whiteSpace: 'normal' }}>
              {formatDayMonth(txn.txn_date)} · {txn.account} · {txn.source === 'manual' ? 'added by hand' : 'imported'}
              {txn.note && <><br />“{txn.note}”</>}
            </p>
            {mine ? (
              <>
                <button className="chip" onClick={() => setPicking(true)}>
                  {cat ? `${cat.icon} ${cat.name}` : '＋ categorise'}{!txn.category_confirmed && cat ? ' (best guess — tap to fix)' : ''}
                </button>
                <button className={`chip${txn.deductible ? ' chip--confirmed' : ''}`} disabled={busy} onClick={() => void toggleDeductible()}>
                  {txn.deductible ? '✓ Tax-deductible' : '＋ Mark tax-deductible'}
                </button>
              </>
            ) : (
              <span className="chip">{cat ? `${cat.icon} ${cat.name}` : 'Uncategorised'}</span>
            )}
            {mine && txn.deductible && (
              <select
                className="input"
                value={txn.deduction_category ?? 'other'}
                onChange={(e) => void changeDeductionCategory(e.target.value as DeductionCategory)}
              >
                {DEDUCTION_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            )}
            {txn.merchant_norm && (
              <button className="btn" onClick={showMerchant}>History at this merchant</button>
            )}
            {merchant && (
              <div className="card" style={{ maxHeight: 180, overflowY: 'auto' }}>
                <h2>{merchant.length} visits · {formatAUD(merchant.reduce((s, t) => s + Math.min(0, t.amount), 0))}</h2>
                {merchant.map((m) => (
                  <div key={m.id} className="row--between" style={{ fontSize: '0.8rem', marginBottom: 4 }}>
                    <span className="muted">{formatDayMonth(m.txn_date)}</span>
                    <span className="amount">{formatAUD(m.amount)}</span>
                  </div>
                ))}
              </div>
            )}
            {mine && <button className="btn" onClick={addAgain}>Add again</button>}
            {mine && <button className="btn" onClick={() => setEditing(true)}>Edit</button>}
            {mine && <button className="btn" style={{ color: 'var(--danger)' }} disabled={busy} onClick={() => void remove()}>Delete</button>}
          </>
        ) : (
          <>
            <h2>Edit</h2>
            <SegmentedControl options={[{ value: 'spend', label: 'Spend' }, { value: 'income', label: 'Income' }]} value={kind} onChange={setKind} />
            <input className="input" type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
            <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} />
            <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            <input className="input" value={account} onChange={(e) => setAccount(e.target.value)} />
            <input className="input" placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
            <button className="btn btn--primary" disabled={busy} onClick={() => void saveEdit()}>Save changes</button>
          </>
        )}
      </div>
      {picking && <CategoryPicker categories={categories} onPick={(id) => void pickCategory(id)} onClose={() => setPicking(false)} />}
    </div>
  )
}
