import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { useRealtime } from '../data/useRealtime'
import { fetchIncome, insertIncome, updateIncome, deleteIncome } from '../data/taxIncome'
import {
  fetchManualDeductions, fetchTaggedDeductions,
  insertDeduction, updateDeduction, deleteDeduction,
} from '../data/taxDeductions'
import { fyLabel, currentFy } from '../domain/fy'
import { formatAUD, formatDayMonth, isoToday } from '../domain/money'
import { StatCard } from '../components/ui/StatCard'
import { SegmentedControl } from '../components/ui/SegmentedControl'
import { EmptyState } from '../components/ui/EmptyState'
import { listDocuments, uploadDocument, deleteDocument, getSignedUrl } from '../data/taxDocuments'
import { fetchChecklist, setChecklistItem } from '../data/taxChecklistState'
import { TAX_CHECKLIST } from '../domain/taxChecklist'
import type { DeductionCategory, IncomeSourceType, TaxChecklistState, TaxDeduction, TaxDocument, TaxIncome, Txn } from '../data/types'

const SOURCE_TYPES: { value: IncomeSourceType; label: string }[] = [
  { value: 'salary', label: 'Salary' },
  { value: 'investment', label: 'Investment' },
  { value: 'business', label: 'Business' },
  { value: 'other', label: 'Other' },
]
const DEDUCTION_CATEGORIES: { value: DeductionCategory; label: string }[] = [
  { value: 'wfh', label: 'Work from home' },
  { value: 'vehicle', label: 'Vehicle' },
  { value: 'self_education', label: 'Self-education' },
  { value: 'donations', label: 'Donations' },
  { value: 'tools', label: 'Tools/equipment' },
  { value: 'other', label: 'Other' },
]
const sourceLabel = (v: string) => SOURCE_TYPES.find((s) => s.value === v)?.label ?? v
const deductionLabel = (v: string) => DEDUCTION_CATEGORIES.find((d) => d.value === v)?.label ?? v

export default function TaxScreen() {
  const { user } = useAuth()
  const [fy, setFy] = useState(currentFy)
  const [income, setIncome] = useState<TaxIncome[]>([])
  const [manualDeductions, setManualDeductions] = useState<TaxDeduction[]>([])
  const [taggedDeductions, setTaggedDeductions] = useState<Txn[]>([])
  const [documents, setDocuments] = useState<TaxDocument[]>([])
  const [uploading, setUploading] = useState(false)
  const [docDetail, setDocDetail] = useState<TaxDocument | null>(null)
  const [checklist, setChecklist] = useState<TaxChecklistState[]>([])

  const load = useCallback(() => {
    fetchIncome(fy).then(setIncome).catch(() => setIncome([]))
    fetchManualDeductions(fy).then(setManualDeductions).catch(() => setManualDeductions([]))
    fetchTaggedDeductions(fy).then(setTaggedDeductions).catch(() => setTaggedDeductions([]))
    listDocuments(fy).then(setDocuments).catch(() => setDocuments([]))
    fetchChecklist(fy).then(setChecklist).catch(() => setChecklist([]))
  }, [fy])
  useEffect(load, [load])
  useRealtime(['tax_income', 'tax_deductions', 'tax_documents', 'tax_checklist_state', 'budget_transactions'], load)

  const toggleChecklist = (key: string, done: boolean) => {
    if (!user) return
    void setChecklistItem(user.id, fy, key, done).then(load)
  }

  const onUpload = async (file: File | undefined) => {
    if (!file || !user) return
    setUploading(true)
    try {
      await uploadDocument(file, { owner_id: user.id, fy, title: file.name, doc_type: 'receipt', link_type: 'none' })
      load()
    } finally {
      setUploading(false)
    }
  }

  const totalIncome = useMemo(() => income.reduce((s, i) => s + i.amount, 0), [income])
  const totalDeductions = useMemo(
    () =>
      manualDeductions.reduce((s, d) => s + d.amount, 0) +
      taggedDeductions.reduce((s, t) => s + Math.abs(t.amount), 0),
    [manualDeductions, taggedDeductions],
  )
  const net = totalIncome - totalDeductions

  const [addingIncome, setAddingIncome] = useState(false)
  const [editIncome, setEditIncome] = useState<TaxIncome | null>(null)
  const [addingDeduction, setAddingDeduction] = useState(false)
  const [editDeduction, setEditDeduction] = useState<TaxDeduction | null>(null)

  if (!user) return null

  return (
    <div className="screen">
      <div className="row--between">
        <h1 className="brand">Tax</h1>
      </div>

      <div className="card">
        <p className="txn__sub" style={{ whiteSpace: 'normal' }}>
          General info + your own records. Not tax or financial advice.
        </p>
      </div>

      <div className="row--between card">
        <button className="btn btn--small btn--pager" onClick={() => setFy((f) => f - 1)}>‹</button>
        <strong>{fyLabel(fy)}</strong>
        <button className="btn btn--small btn--pager" onClick={() => setFy((f) => f + 1)}>›</button>
      </div>

      <div className="row" style={{ gap: 8 }}>
        <StatCard label="Income" value={formatAUD(totalIncome)} />
        <StatCard label="Deductions" value={formatAUD(totalDeductions)} />
        <StatCard label="Net" value={formatAUD(net)} />
      </div>

      <div className="card">
        <div className="row--between">
          <h2>Income</h2>
          <button className="btn btn--small" onClick={() => setAddingIncome(true)}>＋ Add</button>
        </div>
        {income.map((i) => (
          <button key={i.id} className="txn txn--tap" onClick={() => setEditIncome(i)}>
            <div className="txn__main">
              <div className="txn__desc">{i.payer || sourceLabel(i.source_type)}</div>
              <div className="txn__sub">{formatDayMonth(i.date)} · {sourceLabel(i.source_type)}</div>
            </div>
            <span className="amount amount--pos">{formatAUD(i.amount)}</span>
          </button>
        ))}
        {income.length === 0 && <EmptyState icon="💰" title="No income logged" hint={`Add income for ${fyLabel(fy)}.`} />}
      </div>

      <div className="card">
        <div className="row--between">
          <h2>Deductions</h2>
          <button className="btn btn--small" onClick={() => setAddingDeduction(true)}>＋ Add</button>
        </div>
        {manualDeductions.map((d) => (
          <button key={d.id} className="txn txn--tap" onClick={() => setEditDeduction(d)}>
            <div className="txn__main">
              <div className="txn__desc">{d.description}</div>
              <div className="txn__sub">{formatDayMonth(d.date)} · {deductionLabel(d.category)}</div>
            </div>
            <span className="amount">{formatAUD(d.amount)}</span>
          </button>
        ))}
        {taggedDeductions.map((t) => (
          <div key={t.id} className="txn">
            <div className="txn__main">
              <div className="txn__desc">{t.description}</div>
              <div className="txn__sub">
                {formatDayMonth(t.txn_date)} · {t.deduction_category ? deductionLabel(t.deduction_category) : 'tagged'}
                {' '}<span className="badge">from Tally</span>
              </div>
            </div>
            <span className="amount">{formatAUD(Math.abs(t.amount))}</span>
          </div>
        ))}
        {manualDeductions.length === 0 && taggedDeductions.length === 0 && (
          <EmptyState icon="🧾" title="No deductions yet" hint="Add one, or tag a Tally transaction as deductible." />
        )}
      </div>

      <div className="card">
        <div className="row--between">
          <h2>Documents</h2>
          <label className="btn btn--small" style={{ cursor: 'pointer' }}>
            {uploading ? 'Uploading…' : '＋ Add'}
            <input
              type="file" accept="image/*,application/pdf" capture="environment"
              style={{ display: 'none' }} disabled={uploading}
              onChange={(e) => void onUpload(e.target.files?.[0]).then(() => { e.target.value = '' })}
            />
          </label>
        </div>
        {documents.map((d) => (
          <button key={d.id} className="txn txn--tap" onClick={() => setDocDetail(d)}>
            <div className="txn__main">
              <div className="txn__desc">{d.title}</div>
              <div className="txn__sub">{d.date ? `${formatDayMonth(d.date)} · ` : ''}{d.doc_type}</div>
            </div>
          </button>
        ))}
        {documents.length === 0 && <EmptyState icon="📎" title="No receipts filed" hint="Photograph or upload a receipt/statement." />}
      </div>

      <div className="card">
        <h2>EOFY checklist</h2>
        {TAX_CHECKLIST.map((item) => {
          const done = checklist.find((c) => c.item_key === item.key)?.done ?? false
          return (
            <label key={item.key} className="row" style={{ marginBottom: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={done} onChange={(e) => toggleChecklist(item.key, e.target.checked)} />
              <span style={{ textDecoration: done ? 'line-through' : 'none', color: done ? 'var(--muted)' : 'inherit' }}>
                {item.label}
              </span>
            </label>
          )
        })}
      </div>

      {docDetail && (
        <DocumentSheet
          doc={docDetail}
          onClose={() => setDocDetail(null)}
          onDeleted={() => { setDocDetail(null); load() }}
        />
      )}

      {(addingIncome || editIncome) && (
        <IncomeSheet
          fy={fy}
          ownerId={user.id}
          existing={editIncome}
          onClose={() => { setAddingIncome(false); setEditIncome(null) }}
          onSaved={() => { setAddingIncome(false); setEditIncome(null); load() }}
        />
      )}
      {(addingDeduction || editDeduction) && (
        <DeductionSheet
          fy={fy}
          ownerId={user.id}
          existing={editDeduction}
          onClose={() => { setAddingDeduction(false); setEditDeduction(null) }}
          onSaved={() => { setAddingDeduction(false); setEditDeduction(null); load() }}
        />
      )}
    </div>
  )
}

function IncomeSheet({ fy, ownerId, existing, onClose, onSaved }: {
  fy: number
  ownerId: string
  existing: TaxIncome | null
  onClose: () => void
  onSaved: () => void
}) {
  const [sourceType, setSourceType] = useState<IncomeSourceType>(existing?.source_type ?? 'salary')
  const [payer, setPayer] = useState(existing?.payer ?? '')
  const [amount, setAmount] = useState(existing ? String(existing.amount) : '')
  const [date, setDate] = useState(existing?.date ?? isoToday())
  const [note, setNote] = useState(existing?.note ?? '')
  const [busy, setBusy] = useState(false)

  const save = async () => {
    const value = Number(amount)
    if (!Number.isFinite(value) || value <= 0) return
    setBusy(true)
    try {
      if (existing) {
        await updateIncome(existing.id, { source_type: sourceType, payer: payer.trim(), amount: value, date, note: note.trim() })
      } else {
        await insertIncome({ owner_id: ownerId, fy, source_type: sourceType, payer: payer.trim(), amount: value, date, note: note.trim() })
      }
      onSaved()
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!existing) return
    setBusy(true)
    try {
      await deleteIncome(existing.id)
      onSaved()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <h2>{existing ? 'Edit income' : 'Add income'}</h2>
        <SegmentedControl grow options={SOURCE_TYPES} value={sourceType} onChange={setSourceType} />
        <input className="input" placeholder="Payer (optional)" value={payer} onChange={(e) => setPayer(e.target.value)} />
        <input className="input" type="number" inputMode="decimal" placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <input className="input" placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
        <button className="btn btn--primary" disabled={busy} onClick={() => void save()}>Save</button>
        {existing && <button className="btn" style={{ color: 'var(--danger)' }} disabled={busy} onClick={() => void remove()}>Delete</button>}
      </div>
    </div>
  )
}

function DeductionSheet({ fy, ownerId, existing, onClose, onSaved }: {
  fy: number
  ownerId: string
  existing: TaxDeduction | null
  onClose: () => void
  onSaved: () => void
}) {
  const [category, setCategory] = useState<DeductionCategory>(existing?.category ?? 'other')
  const [description, setDescription] = useState(existing?.description ?? '')
  const [amount, setAmount] = useState(existing ? String(existing.amount) : '')
  const [date, setDate] = useState(existing?.date ?? isoToday())
  const [note, setNote] = useState(existing?.note ?? '')
  const [busy, setBusy] = useState(false)

  const save = async () => {
    const value = Number(amount)
    if (!description.trim() || !Number.isFinite(value) || value <= 0) return
    setBusy(true)
    try {
      if (existing) {
        await updateDeduction(existing.id, { category, description: description.trim(), amount: value, date, note: note.trim() })
      } else {
        await insertDeduction({ owner_id: ownerId, fy, category, description: description.trim(), amount: value, date, note: note.trim() })
      }
      onSaved()
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!existing) return
    setBusy(true)
    try {
      await deleteDeduction(existing.id)
      onSaved()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <h2>{existing ? 'Edit deduction' : 'Add deduction'}</h2>
        <select className="input" value={category} onChange={(e) => setCategory(e.target.value as DeductionCategory)}>
          {DEDUCTION_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <input className="input" placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
        <input className="input" type="number" inputMode="decimal" placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <input className="input" placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
        <button className="btn btn--primary" disabled={busy} onClick={() => void save()}>Save</button>
        {existing && <button className="btn" style={{ color: 'var(--danger)' }} disabled={busy} onClick={() => void remove()}>Delete</button>}
      </div>
    </div>
  )
}

function DocumentSheet({ doc, onClose, onDeleted }: { doc: TaxDocument; onClose: () => void; onDeleted: () => void }) {
  const [busy, setBusy] = useState(false)

  const view = async () => {
    const url = await getSignedUrl(doc.storage_path)
    window.open(url, '_blank', 'noopener')
  }

  const remove = async () => {
    setBusy(true)
    try {
      await deleteDocument(doc.id, doc.storage_path)
      onDeleted()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <h2>{doc.title}</h2>
        <p className="txn__sub">{doc.date ? formatDayMonth(doc.date) : ''} · {doc.doc_type}</p>
        <button className="btn" onClick={() => void view()}>View</button>
        <button className="btn" style={{ color: 'var(--danger)' }} disabled={busy} onClick={() => void remove()}>Delete</button>
      </div>
    </div>
  )
}
