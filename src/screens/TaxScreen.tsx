import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { useRealtime } from '../data/useRealtime'
import { fetchIncome } from '../data/taxIncome'
import { fetchManualDeductions, fetchTaggedDeductions } from '../data/taxDeductions'
import { fyLabel, currentFy } from '../domain/fy'
import { formatAUD } from '../domain/money'
import { StatCard } from '../components/ui/StatCard'
import type { TaxDeduction, TaxIncome } from '../data/types'
import type { Txn } from '../data/types'

export default function TaxScreen() {
  const { user } = useAuth()
  const [fy, setFy] = useState(currentFy)
  const [income, setIncome] = useState<TaxIncome[]>([])
  const [manualDeductions, setManualDeductions] = useState<TaxDeduction[]>([])
  const [taggedDeductions, setTaggedDeductions] = useState<Txn[]>([])

  const load = useCallback(() => {
    fetchIncome(fy).then(setIncome).catch(() => setIncome([]))
    fetchManualDeductions(fy).then(setManualDeductions).catch(() => setManualDeductions([]))
    fetchTaggedDeductions(fy).then(setTaggedDeductions).catch(() => setTaggedDeductions([]))
  }, [fy])
  useEffect(load, [load])
  useRealtime(['tax_income', 'tax_deductions', 'budget_transactions'], load)

  const totalIncome = useMemo(() => income.reduce((s, i) => s + i.amount, 0), [income])
  const totalDeductions = useMemo(
    () =>
      manualDeductions.reduce((s, d) => s + d.amount, 0) +
      taggedDeductions.reduce((s, t) => s + Math.abs(t.amount), 0),
    [manualDeductions, taggedDeductions],
  )
  const net = totalIncome - totalDeductions

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
    </div>
  )
}
