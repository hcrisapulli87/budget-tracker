import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { useRealtime } from '../data/useRealtime'
import { fetchIncome, insertIncome, updateIncome, deleteIncome } from '../data/taxIncome'
import {
  fetchManualDeductions, fetchTaggedDeductions,
  insertDeduction, updateDeduction, deleteDeduction,
} from '../data/taxDeductions'
import {
  fetchDeductionCandidates, fetchIncomeCandidates, importedFromTxnNote,
  type DeductionCandidate, type IncomeCandidate,
} from '../data/taxSuggestions'
import { updateTransaction } from '../data/transactions'
import { fyLabel, currentFy } from '../domain/fy'
import { formatAUD, formatDayMonth, isoToday } from '../domain/money'
import { ratesForFy, VEHICLE_KM_CAP } from '../domain/taxRates'
import { buildTaxSummaryCsv, downloadTaxSummary } from '../domain/taxExport'
import { StatCard } from '../components/ui/StatCard'
import { SegmentedControl } from '../components/ui/SegmentedControl'
import { EmptyState } from '../components/ui/EmptyState'
import { listDocuments, uploadDocument, deleteDocument, getSignedUrl } from '../data/taxDocuments'
import { fetchChecklist, setChecklistItem } from '../data/taxChecklistState'
import { TAX_CHECKLIST } from '../domain/taxChecklist'
import { DEDUCTION_CATEGORIES, deductionLabel } from '../domain/deductionCategories'
import type { DeductionCategory, IncomeSourceType, TaxChecklistState, TaxDeduction, TaxDocument, TaxIncome, Txn } from '../data/types'

const SOURCE_TYPES: { value: IncomeSourceType; label: string }[] = [
  { value: 'salary', label: 'Salary' },
  { value: 'investment', label: 'Investment' },
  { value: 'business', label: 'Business' },
  { value: 'other', label: 'Other' },
]
const sourceLabel = (v: string) => SOURCE_TYPES.find((s) => s.value === v)?.label ?? v

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
  const [deductionCandidates, setDeductionCandidates] = useState<DeductionCandidate[]>([])
  const [incomeCandidates, setIncomeCandidates] = useState<IncomeCandidate[]>([])
  const [addingWfh, setAddingWfh] = useState(false)
  const [addingVehicle, setAddingVehicle] = useState(false)

  const load = useCallback(() => {
    fetchIncome(fy).then(setIncome).catch(() => setIncome([]))
    fetchManualDeductions(fy).then(setManualDeductions).catch(() => setManualDeductions([]))
    fetchTaggedDeductions(fy).then(setTaggedDeductions).catch(() => setTaggedDeductions([]))
    listDocuments(fy).then(setDocuments).catch(() => setDocuments([]))
    fetchChecklist(fy).then(setChecklist).catch(() => setChecklist([]))
    fetchDeductionCandidates(fy).then(setDeductionCandidates).catch(() => setDeductionCandidates([]))
    fetchIncomeCandidates(fy).then(setIncomeCandidates).catch(() => setIncomeCandidates([]))
  }, [fy])
  useEffect(load, [load])
  useRealtime(['tax_income', 'tax_deductions', 'tax_documents', 'tax_checklist_state', 'budget_transactions'], load)

  const acceptDeduction = async (c: DeductionCandidate, category: DeductionCategory) => {
    await updateTransaction(c.txn.id, { deductible: true, deduction_category: category })
    load()
  }
  const acceptAllDeductions = async () => {
    for (const c of deductionCandidates) await updateTransaction(c.txn.id, { deductible: true, deduction_category: c.suggestedCategory })
    load()
  }
  const acceptIncome = async (c: IncomeCandidate) => {
    if (!user) return
    await insertIncome({
      owner_id: user.id, fy,
      source_type: c.suggestedSource, payer: c.txn.description, amount: c.txn.amount,
      date: c.txn.txn_date, note: importedFromTxnNote(c.txn.id),
    })
    load()
  }
  const incomeBySource = useMemo(() => {
    const groups = new Map<IncomeSourceType, IncomeCandidate[]>()
    for (const c of incomeCandidates) groups.set(c.suggestedSource, [...(groups.get(c.suggestedSource) ?? []), c])
    return [...groups.entries()]
  }, [incomeCandidates])

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

  const exportSummary = () => {
    const csv = buildTaxSummaryCsv(fy, income, manualDeductions, taggedDeductions, documents)
    downloadTaxSummary(fy, csv)
  }

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

      {(deductionCandidates.length > 0 || incomeCandidates.length > 0) && (
        <div className="card">
          <h2>Review from your activity</h2>
          {deductionCandidates.length > 0 && (
            <>
              <div className="row--between">
                <strong style={{ fontSize: '0.85rem' }}>Suggested deductions ({deductionCandidates.length})</strong>
                <button className="btn btn--small" onClick={() => void acceptAllDeductions()}>Accept all</button>
              </div>
              {deductionCandidates.map((c) => (
                <div key={c.txn.id} className="txn">
                  <div className="txn__main">
                    <div className="txn__desc">{c.txn.description}</div>
                    <div className="txn__sub">
                      {formatDayMonth(c.txn.txn_date)} · best guess: {deductionLabel(c.suggestedCategory)}
                    </div>
                  </div>
                  <div className="txn__side">
                    <span className="amount">{formatAUD(Math.abs(c.txn.amount))}</span>
                    <button className="btn btn--small" onClick={() => void acceptDeduction(c, c.suggestedCategory)}>Accept</button>
                  </div>
                </div>
              ))}
            </>
          )}
          {incomeCandidates.length > 0 && (
            <>
              <p className="txn__sub" style={{ whiteSpace: 'normal', marginTop: deductionCandidates.length > 0 ? 12 : 0 }}>
                <strong>Income cross-check</strong> — from your bank activity (net), a record to check against your ATO pre-fill. Not the figure you lodge.
              </p>
              {incomeBySource.map(([source, list]) => (
                <div key={source} style={{ marginBottom: 8 }}>
                  <div className="txn__sub" style={{ fontWeight: 600 }}>
                    {sourceLabel(source)} · {formatAUD(list.reduce((s, c) => s + c.txn.amount, 0))}
                  </div>
                  {list.map((c) => (
                    <div key={c.txn.id} className="txn">
                      <div className="txn__main">
                        <div className="txn__desc">{c.txn.description}</div>
                        <div className="txn__sub">{formatDayMonth(c.txn.txn_date)}</div>
                      </div>
                      <div className="txn__side">
                        <span className="amount amount--pos">{formatAUD(c.txn.amount)}</span>
                        <button className="btn btn--small" onClick={() => void acceptIncome(c)}>Accept</button>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </>
          )}
        </div>
      )}

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
          <div className="row" style={{ gap: 6 }}>
            <button className="btn btn--small" onClick={() => setAddingWfh(true)}>WFH calc</button>
            <button className="btn btn--small" onClick={() => setAddingVehicle(true)}>Vehicle calc</button>
            <button className="btn btn--small" onClick={() => setAddingDeduction(true)}>＋ Add</button>
          </div>
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

      <button className="btn" style={{ width: '100%' }} onClick={exportSummary}>Export summary (CSV)</button>

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
      {addingWfh && (
        <WfhSheet fy={fy} ownerId={user.id} onClose={() => setAddingWfh(false)} onSaved={() => { setAddingWfh(false); load() }} />
      )}
      {addingVehicle && (
        <VehicleSheet fy={fy} ownerId={user.id} onClose={() => setAddingVehicle(false)} onSaved={() => { setAddingVehicle(false); load() }} />
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

function WfhSheet({ fy, ownerId, onClose, onSaved }: { fy: number; ownerId: string; onClose: () => void; onSaved: () => void }) {
  const [hours, setHours] = useState('')
  const [date, setDate] = useState(isoToday())
  const [busy, setBusy] = useState(false)
  const rate = ratesForFy(fy).wfhCentsPerHour
  const hoursNum = Number(hours)
  const amount = Number.isFinite(hoursNum) && hoursNum > 0 ? (hoursNum * rate) / 100 : 0

  const save = async () => {
    if (!Number.isFinite(hoursNum) || hoursNum <= 0) return
    setBusy(true)
    try {
      await insertDeduction({
        owner_id: ownerId, fy, category: 'wfh',
        description: `Work-from-home, ${hoursNum} hrs @ ${rate}c/hr`, amount, date, note: 'ATO fixed-rate method',
      })
      onSaved()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <h2>Work-from-home calculator</h2>
        <p className="txn__sub" style={{ whiteSpace: 'normal' }}>
          ATO fixed-rate method: {rate}c per hour worked from home for FY{fy}. Verify the current rate at ato.gov.au before lodging.
        </p>
        <input className="input" type="number" inputMode="decimal" placeholder="Hours worked from home this FY" value={hours} onChange={(e) => setHours(e.target.value)} />
        <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <p className="txn__sub">Deduction: <strong>{formatAUD(amount)}</strong></p>
        <button className="btn btn--primary" disabled={busy || amount <= 0} onClick={() => void save()}>Add deduction</button>
      </div>
    </div>
  )
}

function VehicleSheet({ fy, ownerId, onClose, onSaved }: { fy: number; ownerId: string; onClose: () => void; onSaved: () => void }) {
  const [km, setKm] = useState('')
  const [date, setDate] = useState(isoToday())
  const [busy, setBusy] = useState(false)
  const rate = ratesForFy(fy).vehicleCentsPerKm
  const kmNum = Number(km)
  const cappedKm = Number.isFinite(kmNum) ? Math.min(Math.max(kmNum, 0), VEHICLE_KM_CAP) : 0
  const amount = (cappedKm * rate) / 100

  const save = async () => {
    if (!Number.isFinite(kmNum) || kmNum <= 0) return
    setBusy(true)
    try {
      await insertDeduction({
        owner_id: ownerId, fy, category: 'vehicle',
        description: `Vehicle, ${cappedKm} km @ ${rate}c/km`, amount, date, note: 'ATO cents-per-km method',
      })
      onSaved()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <h2>Vehicle calculator</h2>
        <p className="txn__sub" style={{ whiteSpace: 'normal' }}>
          ATO cents-per-km method: {rate}c/km, capped at {VEHICLE_KM_CAP} km per FY. Verify the current rate at ato.gov.au before lodging.
        </p>
        <input className="input" type="number" inputMode="decimal" placeholder="Business km this FY" value={km} onChange={(e) => setKm(e.target.value)} />
        {kmNum > VEHICLE_KM_CAP && <p className="txn__sub warn">Capped at {VEHICLE_KM_CAP} km — the rest isn't deductible under this method.</p>}
        <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <p className="txn__sub">Deduction: <strong>{formatAUD(amount)}</strong></p>
        <button className="btn btn--primary" disabled={busy || amount <= 0} onClick={() => void save()}>Add deduction</button>
      </div>
    </div>
  )
}
