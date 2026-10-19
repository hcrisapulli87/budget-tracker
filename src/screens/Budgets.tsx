import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useData } from '../data/DataProvider'
import { fetchTransactions } from '../data/transactions'
import { clearBudget, setBudget, setRollover } from '../data/budgets'
import { fetchBills } from '../data/bills'
import { fetchSubscriptions } from '../data/subscriptions'
import { fetchGoals } from '../data/goals'
import { useRealtime } from '../data/useRealtime'
import { budgetPace, budgetUsage, earliestBudgetMonth, spendByCategoryMonth } from '../domain/budgetMath'
import { expandSplits } from '../domain/splits'
import { buildRecurring } from '../domain/recurring'
import { sinkingFunds } from '../domain/sinkingFunds'
import { visibleTo } from '../domain/ownership'
import { formatAUD, formatDayMonth, isoToday } from '../domain/money'
import { ProgressBar } from '../components/ui/ProgressBar'
import { Toggle } from '../components/ui/Toggle'
import { EmptyState } from '../components/ui/EmptyState'
import { PersonSwitcher } from '../components/PersonSwitcher'
import { GoalSheet } from '../components/GoalSheet'
import { GoalsCard } from '../components/GoalsCard'
import type { Bill, Goal, Subscription, Txn } from '../data/types'

function monthBounds(iso: string): { from: string; to: string } {
  const [y, m] = iso.split('-').map(Number)
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return { from: `${iso}-01`, to: `${iso}-${String(last).padStart(2, '0')}` }
}

export default function Budgets() {
  const { categories, budgets, reload, viewId, readOnly } = useData()
  const [txns, setTxns] = useState<Txn[]>([])
  const [bills, setBills] = useState<Bill[]>([])
  const [subs, setSubs] = useState<Subscription[]>([])
  const [goals, setGoals] = useState<Goal[]>([])
  const [goalSheet, setGoalSheet] = useState<Goal | 'new' | null>(null)
  const [editing, setEditing] = useState(false)
  const today = isoToday()
  const month = today.slice(0, 7)
  const { to } = monthBounds(month)
  const dayOfMonth = Number(today.slice(8, 10))
  const daysInMonth = Number(to.slice(8, 10))

  // fetch back to the earliest rollover start so carry-over can be computed
  const earliest = useMemo(() => earliestBudgetMonth(budgets, month), [budgets, month])

  const load = useCallback(() => {
    if (!viewId) return
    fetchTransactions(`${earliest}-01`, to, viewId).then(setTxns).catch(() => setTxns([]))
    fetchBills().then((b) => setBills(visibleTo(b, viewId))).catch(() => setBills([]))
    fetchSubscriptions().then((s) => setSubs(s.filter((x) => x.owner_id === viewId))).catch(() => setSubs([]))
    fetchGoals().then((g) => setGoals(visibleTo(g, viewId).filter((x) => !x.is_archived))).catch(() => setGoals([]))
  }, [earliest, to, viewId])
  useEffect(load, [load])
  useRealtime(['budget_transactions', 'budget_budgets', 'budget_goals', 'budget_bills', 'budget_subscriptions'], load)

  // split transactions count once per part
  const spend = useMemo(() => spendByCategoryMonth(expandSplits(txns)), [txns])

  const rows = useMemo(() => {
    return budgets
      .map((b) => {
        const u = budgetUsage(b, spend, month)
        const cat = categories.find((c) => c.id === b.category_id)
        return { ...u, cat, pace: budgetPace(u.spent, u.available, dayOfMonth, daysInMonth) }
      })
      .sort((a, b) => b.spent / (b.available || 1) - a.spent / (a.available || 1))
  }, [budgets, spend, categories, month, dayOfMonth, daysInMonth])

  const funds = useMemo(() => sinkingFunds(buildRecurring(bills, subs), today), [bills, subs, today])
  const fundsMonthly = funds.reduce((s, f) => s + f.monthly, 0)

  const totalLimit = rows.reduce((s, r) => s + r.available, 0)
  const totalSpent = rows.reduce((s, r) => s + r.spent, 0)
  const usedPct = totalLimit > 0 ? Math.round((totalSpent / totalLimit) * 100) : 0
  const overCount = rows.filter((r) => r.spent > r.available).length

  const save = async (categoryId: string, raw: string) => {
    const value = Number(raw)
    if (!raw.trim() || value <= 0) await clearBudget(viewId, categoryId)
    else await setBudget(viewId, categoryId, value)
    await reload()
  }

  const toggleRollover = async (categoryId: string, on: boolean) => {
    await setRollover(viewId, categoryId, on, on ? `${month}-01` : null)
    await reload()
  }

  return (
    <div className="screen">
      <div className="row--between">
        <h1 className="brand">Budgets</h1>
        <div className="row" style={{ gap: 8 }}>
          <PersonSwitcher />
          {!readOnly && <button className="btn btn--small" onClick={() => setEditing((v) => !v)}>{editing ? 'Done' : 'Edit'}</button>}
        </div>
      </div>

      <div className="hero" style={{ cursor: 'default' }}>
        <div className="hero__label">Used this month</div>
        <div className="stat">{formatAUD(totalSpent)} <span style={{ fontSize: '1rem', color: 'var(--dim)' }}>of {formatAUD(totalLimit)}</span></div>
        <div className={`delta ${overCount > 0 ? 'error' : usedPct > 90 ? 'warn' : 'amount--pos'}`}>
          {usedPct}% used{overCount > 0 ? ` · ${overCount} over budget` : ''}
        </div>
      </div>

      {editing && !readOnly ? (
        <div className="card">
          <h2>Set monthly limits</h2>
          <p className="txn__sub" style={{ whiteSpace: 'normal' }}>Roll over carries what you don't spend (or overspend) into next month — good for lumpy costs like clothes or car servicing.</p>
          {categories.filter((c) => !c.is_archived && !c.exclude_from_analytics).map((c) => {
            const b = budgets.find((x) => x.category_id === c.id)
            return (
              <div key={c.id} className="row--between" style={{ marginBottom: 8 }}>
                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.icon} {c.name}</span>
                <input
                  className="input" type="number" inputMode="decimal" placeholder="—"
                  defaultValue={b ? String(b.monthly_limit) : ''}
                  style={{ width: 90 }}
                  onBlur={(e) => void save(c.id, e.target.value)}
                />
                <span className="txn__sub">roll</span>
                {b ? <Toggle on={!!b.rollover} label={`Roll over ${c.name}`} onChange={(on) => void toggleRollover(c.id, on)} /> : <span style={{ width: 46 }} />}
              </div>
            )
          })}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState icon="🎯" title="No budgets yet" hint={readOnly ? undefined : 'Tap Edit to set a monthly limit on any category.'} />
      ) : (
        <div className="card">
          {rows.map((r) => (
            <div key={r.id} style={{ marginBottom: 14 }}>
              <div className="row--between" style={{ fontSize: '0.9rem', marginBottom: 4 }}>
                <span>{r.cat?.icon} {r.cat?.name}{r.rollover && <> <span className="badge">↻ rolls over</span></>}</span>
                <span className={r.pace.status === 'over' ? 'error' : r.pace.status === 'hot' ? 'warn' : 'muted'}>
                  {formatAUD(r.spent)} of {formatAUD(r.available)}
                </span>
              </div>
              <ProgressBar value={r.spent} max={r.available} markerAt={r.pace.expected}
                tone={r.pace.status === 'over' ? 'over' : r.pace.status === 'hot' ? 'warn' : 'ok'} />
              {r.rollover && r.carry !== 0 && (
                <div className="txn__sub">{formatAUD(r.monthly_limit)} + {r.carry > 0 ? `${formatAUD(r.carry)} carried in` : `${formatAUD(r.carry)} overspend carried`}</div>
              )}
            </div>
          ))}
        </div>
      )}

      <GoalsCard goals={goals} today={today} onOpen={readOnly ? undefined : (g) => setGoalSheet(g)} onAdd={readOnly ? undefined : () => setGoalSheet('new')} />

      {funds.length > 0 && (
        <div className="card">
          <div className="row--between">
            <h2>Sinking funds</h2>
            <span className="txn__sub">{formatAUD(fundsMonthly)}/mo</span>
          </div>
          <p className="txn__sub" style={{ whiteSpace: 'normal' }}>
            Your quarterly and annual bills as a monthly set-aside, so they never ambush a month. The bar shows how much should be put away by now.
          </p>
          {funds.map((f) => (
            <div key={f.key} style={{ marginBottom: 12 }}>
              <div className="row--between" style={{ fontSize: '0.88rem', marginBottom: 4 }}>
                <span>{f.name}</span>
                <span className="muted">{formatAUD(f.monthly)}/mo · {formatAUD(f.amount)} due {formatDayMonth(f.next)}</span>
              </div>
              <ProgressBar value={f.shouldHave} max={f.amount} />
              <div className="txn__sub">{formatAUD(f.shouldHave)} should be set aside by now</div>
            </div>
          ))}
        </div>
      )}

      <p className="txn__sub" style={{ whiteSpace: 'normal' }}>
        The marker shows where you'd be if spending evenly across the month.
        <br /><Link to="/trends" className="txn__sub">See spending trends →</Link>
      </p>

      {goalSheet && !readOnly && (
        <GoalSheet goal={goalSheet === 'new' ? null : goalSheet} ownerId={viewId} onClose={() => setGoalSheet(null)} onSaved={() => { setGoalSheet(null); load() }} />
      )}
    </div>
  )
}
