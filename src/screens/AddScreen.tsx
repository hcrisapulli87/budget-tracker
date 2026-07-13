import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { useData } from '../data/DataProvider'
import { fetchTransactions, insertTransactions } from '../data/transactions'
import { fetchAccounts } from '../data/accounts'
import { deriveTemplates } from '../domain/templates'
import type { Template } from '../domain/templates'
import { formatAUD, isoToday, addDaysIso } from '../domain/money'
import { normaliseMerchant } from '../domain/merchant'
import { Numpad } from '../components/ui/Numpad'
import { CategoryGrid } from '../components/ui/CategoryGrid'
import { SegmentedControl } from '../components/ui/SegmentedControl'
import type { Account, Txn } from '../data/types'

export interface AddPrefill {
  description?: string
  amount?: number // positive dollars
  category_id?: string | null
  account?: string
  kind?: 'spend' | 'income'
}

export default function AddScreen() {
  const { user } = useAuth()
  const { categories } = useData()
  const navigate = useNavigate()
  const prefill = (useLocation().state ?? undefined) as AddPrefill | undefined

  const [amount, setAmount] = useState(prefill?.amount !== undefined ? String(prefill.amount) : '')
  const [kind, setKind] = useState<'spend' | 'income'>(prefill?.kind ?? 'spend')
  const [description, setDescription] = useState(prefill?.description ?? '')
  const [categoryId, setCategoryId] = useState<string | null>(prefill?.category_id ?? null)
  const [account, setAccount] = useState(prefill?.account ?? localStorage.getItem('tally.account') ?? 'cash')
  const [date, setDate] = useState(isoToday())
  const [note, setNote] = useState('')
  const [accounts, setAccounts] = useState<Account[]>([])
  const [recent, setRecent] = useState<Txn[]>([])
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState('')

  useEffect(() => {
    fetchAccounts().then(setAccounts).catch(() => setAccounts([]))
    // 90-day window feeds template derivation
    fetchTransactions(addDaysIso(isoToday(), -90), isoToday()).then(setRecent).catch(() => setRecent([]))
  }, [])

  const templates = useMemo(
    () => deriveTemplates(recent.filter((t) => t.owner_id === user?.id), isoToday()),
    [recent, user],
  )

  const applyTemplate = (t: Template) => {
    setAmount(String(t.amount))
    setKind('spend')
    setDescription(t.description)
    setCategoryId(t.category_id)
    setAccount(t.account)
  }

  const value = Number(amount)
  const valid = description.trim() !== '' && Number.isFinite(value) && value > 0

  const save = async () => {
    if (!valid || !user) return
    setBusy(true)
    try {
      await insertTransactions([{
        owner_id: user.id,
        account: account.trim() || 'cash',
        txn_date: date,
        amount: kind === 'spend' ? -Math.abs(value) : Math.abs(value),
        description: description.trim(),
        merchant_norm: normaliseMerchant(description),
        category_id: categoryId,
        category_confirmed: categoryId !== null,
        import_hash: `manual-${crypto.randomUUID()}`,
        source: 'manual' as const,
        import_id: null,
        note: note.trim(),
      }])
      localStorage.setItem('tally.account', account.trim() || 'cash')
      setSaved(`${formatAUD(kind === 'spend' ? -value : value)} saved`)
      setTimeout(() => navigate('/transactions'), 450)
    } finally {
      setBusy(false)
    }
  }

  const activeCategories = categories.filter((c) => !c.is_archived)
  const accountNames = [...new Set(['cash', ...accounts.filter((a) => !a.is_archived).map((a) => a.name)])]

  return (
    <div className="screen">
      <div className="row--between">
        <h1 className="brand">Add</h1>
        <SegmentedControl
          options={[{ value: 'spend', label: 'Spend' }, { value: 'income', label: 'Income' }]}
          value={kind}
          onChange={setKind}
        />
      </div>

      {templates.length > 0 && (
        <div className="tile-row">
          {templates.map((t, i) => (
            <button key={i} className="qtile" onClick={() => applyTemplate(t)}>
              <span className="txn__sub">{t.description}</span>
              <span className="amount">{formatAUD(-t.amount)}</span>
            </button>
          ))}
        </div>
      )}

      <div className={`amount-display${kind === 'income' ? ' income' : ''}`}>
        {amount === '' ? '$0' : formatAUD(kind === 'spend' ? -Number(amount || 0) : Number(amount || 0))}
      </div>
      <Numpad value={amount} onChange={setAmount} />

      <div className="card" style={{ marginTop: 12 }}>
        <input className="input" placeholder="What was it? (e.g. Coffee)" value={description} onChange={(e) => setDescription(e.target.value)} />
        <div style={{ marginTop: 10 }}>
          <CategoryGrid categories={activeCategories} value={categoryId} onPick={(id) => setCategoryId(id === categoryId ? null : id)} />
        </div>
        <div className="row" style={{ marginTop: 10, flexWrap: 'wrap' }}>
          {accountNames.map((n) => (
            <button key={n} className={`chip${n === account ? ' chip--confirmed' : ''}`} onClick={() => setAccount(n)}>{n}</button>
          ))}
        </div>
        <div className="row" style={{ marginTop: 10 }}>
          <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <button className="btn btn--small" onClick={() => setDate(addDaysIso(isoToday(), -1))}>Yesterday</button>
        </div>
        <input className="input" style={{ marginTop: 10 }} placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>

      {saved && <p className="amount--pos">✅ {saved}</p>}
      <button className="btn btn--primary" style={{ width: '100%' }} disabled={!valid || busy} onClick={() => void save()}>
        Save
      </button>
    </div>
  )
}
