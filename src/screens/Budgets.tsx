import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useData } from '../data/DataProvider'
import { fetchTransactions } from '../data/transactions'
import { clearBudget, setBudget } from '../data/budgets'
import { useRealtime } from '../data/useRealtime'
import { budgetPace } from '../domain/budgetMath'
import { formatAUD, isoToday } from '../domain/money'
import { ProgressBar } from '../components/ui/ProgressBar'
import { EmptyState } from '../components/ui/EmptyState'
import type { Txn } from '../data/types'

function monthBounds(iso: string): { from: string; to: string } {
  const [y, m] = iso.split('-').map(Number)
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return { from: `${iso}-01`, to: `${iso}-${String(last).padStart(2, '0')}` }
}

export default function Budgets() {
  const { categories, budgets, reload } = useData()
  const [txns, setTxns] = useState<Txn[]>([])
  const [editing, setEditing] = useState(false)
  const today = isoToday()
  const month = today.slice(0, 7)
  const { from, to } = monthBounds(month)
  const dayOfMonth = Number(today.slice(8, 10))
  const daysInMonth = Number(to.slice(8, 10))

  const load = useCallback(() => {
    fetchTransactions(from, to).then(setTxns).catch(() => setTxns([]))
  }, [from, to])
  useEffect(load, [load])
  useRealtime(['budget_transactions', 'budget_budgets'], load)

  const spentByCat = useMemo(() => {
    const m = new Map<string, number>()
    for (const t of txns) {
      if (t.amount >= 0 || !t.category_id) continue
      m.set(t.category_id, (m.get(t.category_id) ?? 0) - t.amount)
    }
    return m
  }, [txns])

  const rows = useMemo(() => {
    return budgets
      .map((b) => {
        const spent = spentByCat.get(b.category_id) ?? 0
        const cat = categories.find((c) => c.id === b.category_id)
        const pace = budgetPace(spent, b.monthly_limit, dayOfMonth, daysInMonth)
        return { ...b, spent, cat, pace }
      })
      .sort((a, b) => b.spent / (b.monthly_limit || 1) - a.spent / (a.monthly_limit || 1))
  }, [budgets, spentByCat, categories, dayOfMonth, daysInMonth])

  const totalLimit = budgets.reduce((s, b) => s + b.monthly_limit, 0)
  const totalSpent = rows.reduce((s, r) => s + r.spent, 0)
  const usedPct = totalLimit > 0 ? Math.round((totalSpent / totalLimit) * 100) : 0
  const overCount = rows.filter((r) => r.spent > r.monthly_limit).length

  const save = async (categoryId: string, raw: string) => {
    const value = Number(raw)
    if (!raw.trim() || value <= 0) await clearBudget(categoryId)
    else await setBudget(categoryId, value)
    await reload()
  }

  return (
    <div className="screen">
      <div className="row--between">
        <h1 className="brand">Budgets</h1>
        <button className="btn btn--small" onClick={() => setEditing((v) => !v)}>{editing ? 'Done' : 'Edit'}</button>
      </div>

      <div className="hero" style={{ cursor: 'default' }}>
        <div className="hero__label">Used this month</div>
        <div className="stat">{formatAUD(totalSpent)} <span style={{ fontSize: '1rem', color: 'var(--dim)' }}>of {formatAUD(totalLimit)}</span></div>
        <div className={`delta ${overCount > 0 ? 'error' : usedPct > 90 ? 'warn' : 'amount--pos'}`}>
          {usedPct}% used{overCount > 0 ? ` · ${overCount} over budget` : ''}
        </div>
      </div>

      {editing ? (
        <div className="card">
          <h2>Set monthly limits</h2>
          {categories.filter((c) => !c.is_archived).map((c) => {
            const b = budgets.find((x) => x.category_id === c.id)
            return (
              <div key={c.id} className="row--between" style={{ marginBottom: 8 }}>
                <span style={{ flex: 1 }}>{c.icon} {c.name}</span>
                <input
                  className="input" type="number" inputMode="decimal" placeholder="—"
                  defaultValue={b ? String(b.monthly_limit) : ''}
                  style={{ width: 100 }}
                  onBlur={(e) => void save(c.id, e.target.value)}
                />
              </div>
            )
          })}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState icon="🎯" title="No budgets yet" hint="Tap Edit to set a monthly limit on any category." />
      ) : (
        <div className="card">
          {rows.map((r) => (
            <div key={r.id} style={{ marginBottom: 14 }}>
              <div className="row--between" style={{ fontSize: '0.9rem', marginBottom: 4 }}>
                <span>{r.cat?.icon} {r.cat?.name}</span>
                <span className={r.pace.status === 'over' ? 'error' : r.pace.status === 'hot' ? 'warn' : 'muted'}>
                  {formatAUD(r.spent)} of {formatAUD(r.monthly_limit)}
                </span>
              </div>
              <ProgressBar value={r.spent} max={r.monthly_limit} markerAt={r.pace.expected}
                tone={r.pace.status === 'over' ? 'over' : r.pace.status === 'hot' ? 'warn' : 'ok'} />
            </div>
          ))}
        </div>
      )}

      <p className="txn__sub" style={{ whiteSpace: 'normal' }}>
        Budgets are household-wide. The marker shows where you'd be if spending evenly across the month.
        <br /><Link to="/insights" className="txn__sub">See spending trends →</Link>
      </p>
    </div>
  )
}
