import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { useData } from '../data/DataProvider'
import { fetchTransactions } from '../data/transactions'
import { useRealtime } from '../data/useRealtime'
import { useWho } from '../lib/useWho'
import {
  rangeBounds, cashFlow, categoryBreakdownWithDelta, merchantLeaderboard,
  dayOfWeekPattern, averages,
} from '../domain/stats'
import type { Range } from '../domain/stats'
import { budgetPace } from '../domain/budgetMath'
import { formatAUD, formatDayMonth, isoToday } from '../domain/money'
import { SegmentedControl } from '../components/ui/SegmentedControl'
import { ProgressBar } from '../components/ui/ProgressBar'
import { StatCard } from '../components/ui/StatCard'
import { EmptyState } from '../components/ui/EmptyState'
import type { Txn } from '../data/types'

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default function Insights() {
  const { user } = useAuth()
  const { categories, budgets } = useData()
  const [who, setWho] = useWho()
  const [range, setRange] = useState<Range>('month')
  const [txns, setTxns] = useState<Txn[]>([])
  const [drill, setDrill] = useState<string | null>(null) // category id

  const today = isoToday()
  const bounds = useMemo(() => rangeBounds(range, today), [range, today])

  const load = useCallback(() => {
    // fetch prev+current window in one go
    fetchTransactions(bounds.prevFrom, bounds.to).then(setTxns).catch(() => setTxns([]))
  }, [bounds])
  useEffect(load, [load])
  useRealtime(['budget_transactions', 'budget_budgets'], load)

  const excluded = useMemo(
    () => new Set(categories.filter((c) => c.exclude_from_analytics).map((c) => c.id)),
    [categories],
  )
  const mine = useMemo(() => (who === 'all' ? txns : txns.filter((t) => t.owner_id === user?.id)), [txns, who, user])

  const cf = useMemo(() => cashFlow(mine, bounds.from, bounds.to, excluded), [mine, bounds, excluded])
  const cats = useMemo(() => categoryBreakdownWithDelta(mine, bounds, excluded), [mine, bounds, excluded])
  const leaders = useMemo(() => merchantLeaderboard(mine, bounds.from, bounds.to, excluded), [mine, bounds, excluded])
  const dow = useMemo(() => dayOfWeekPattern(mine, bounds.from, bounds.to, excluded), [mine, bounds, excluded])
  const avg = useMemo(() => averages(mine, bounds.from, bounds.to, excluded), [mine, bounds, excluded])

  const cat = (id: string | null) => categories.find((c) => c.id === id)
  const totalSpend = cats.reduce((s, c) => s + c.total, 0)
  const maxDow = Math.max(1, ...dow)

  // budgets always measure the household month, independent of range/person
  const monthB = rangeBounds('month', today)
  const monthTxns = txns.filter((t) => t.txn_date >= monthB.from && t.txn_date <= monthB.to)
  const dayOfMonth = Number(today.slice(8, 10))
  const daysInMonth = Number(monthB.to.slice(8, 10))

  // donut geometry
  const donut = useMemo(() => {
    let acc = 0
    return cats.slice(0, 6).map((c) => {
      const start = acc
      acc += totalSpend === 0 ? 0 : c.total / totalSpend
      return { ...c, start, end: acc }
    })
  }, [cats, totalSpend])

  return (
    <div className="screen">
      <div className="row--between">
        <h1 className="brand">Insights</h1>
        <SegmentedControl options={[{ value: 'mine', label: 'Me' }, { value: 'all', label: 'Both' }]} value={who} onChange={setWho} />
      </div>
      <SegmentedControl
        grow
        options={[{ value: 'week', label: 'Week' }, { value: 'month', label: 'Month' }, { value: '3m', label: '3M' }, { value: 'year', label: 'Year' }]}
        value={range}
        onChange={setRange}
      />

      <div className="row" style={{ margin: '12px 0' }}>
        <StatCard label="In" value={formatAUD(cf.moneyIn)} />
        <StatCard label="Out" value={formatAUD(cf.moneyOut)} />
        <StatCard label="Net" value={formatAUD(cf.net)} sub={cf.net >= 0 ? 'ahead' : 'behind'} />
      </div>

      {cf.byMonth.length > 1 && (
        <div className="card">
          <h2>Cash flow by month</h2>
          {cf.byMonth.map((m) => {
            const max = Math.max(1, ...cf.byMonth.map((x) => Math.max(x.moneyIn, x.moneyOut)))
            return (
              <div key={m.month} style={{ marginBottom: 8 }}>
                <div className="txn__sub">{m.month}</div>
                <div className="row"><div className="bar" style={{ width: `${(m.moneyIn / max) * 70}%` }} /><span className="txn__sub amount">{formatAUD(m.moneyIn)}</span></div>
                <div className="row"><div className="bar" style={{ width: `${(m.moneyOut / max) * 70}%`, background: 'var(--danger)' }} /><span className="txn__sub amount">{formatAUD(m.moneyOut)}</span></div>
              </div>
            )
          })}
        </div>
      )}

      <div className="card">
        <h2>Where it went</h2>
        {cats.length === 0 && <EmptyState icon="📈" title="No spending in this range" />}
        {cats.length > 0 && (
          <div className="row" style={{ alignItems: 'flex-start' }}>
            <svg viewBox="0 0 42 42" width="110" height="110" aria-label="Category share">
              {donut.map((d) => {
                const R = 15.9155
                const dash = (d.end - d.start) * 100
                return (
                  <circle key={d.categoryId ?? 'none'} r={R} cx="21" cy="21" fill="transparent"
                    stroke={cat(d.categoryId)?.colour ?? '#8ba59a'} strokeWidth="6"
                    strokeDasharray={`${dash} ${100 - dash}`} strokeDashoffset={-d.start * 100 + 25} />
                )
              })}
            </svg>
            <div style={{ flex: 1, minWidth: 0 }}>
              {cats.slice(0, 6).map((c) => (
                <button key={c.categoryId ?? 'none'} className="txn txn--tap" onClick={() => c.categoryId && setDrill(c.categoryId)}>
                  <span className="legend-dot" style={{ background: cat(c.categoryId)?.colour ?? '#8ba59a' }} />
                  <div className="txn__main">
                    <div className="txn__desc" style={{ fontSize: '0.82rem' }}>{cat(c.categoryId)?.name ?? 'Uncategorised'}</div>
                    <div className="txn__sub">{Math.round(c.share * 100)}% · {c.delta >= 0 ? '▲' : '▼'} {formatAUD(Math.abs(c.delta))}</div>
                  </div>
                  <span className="amount" style={{ fontSize: '0.85rem' }}>{formatAUD(c.total)}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {budgets.length > 0 && (
        <div className="card">
          <h2>Budgets · {formatDayMonth(today)} (day {dayOfMonth} of {daysInMonth})</h2>
          {budgets.map((b) => {
            const c = cat(b.category_id)
            const spent = monthTxns
              .filter((t) => t.category_id === b.category_id && t.amount < 0)
              .reduce((s, t) => s - t.amount, 0)
            const pace = budgetPace(spent, b.monthly_limit, dayOfMonth, daysInMonth)
            return (
              <div key={b.id} style={{ marginBottom: 10 }}>
                <div className="row--between" style={{ fontSize: '0.85rem' }}>
                  <span>{c?.icon} {c?.name}</span>
                  <span className={pace.status === 'over' ? 'error' : pace.status === 'hot' ? 'warn' : 'muted'}>
                    {formatAUD(spent)} of {formatAUD(b.monthly_limit)}
                  </span>
                </div>
                <ProgressBar value={spent} max={b.monthly_limit} markerAt={pace.expected}
                  tone={pace.status === 'over' ? 'over' : pace.status === 'hot' ? 'warn' : 'ok'} />
              </div>
            )
          })}
          <p className="txn__sub" style={{ whiteSpace: 'normal' }}>Budgets track the household (both of you) against each shared limit.</p>
        </div>
      )}

      {leaders.length > 0 && (
        <div className="card">
          <h2>Top merchants</h2>
          {leaders.map((l, i) => (
            <div key={l.merchant} className="leader-row">
              <span className="rank">{i + 1}</span>
              <div className="txn__main">
                <div className="txn__desc" style={{ fontSize: '0.85rem' }}>{l.label}</div>
                <div className="txn__sub">{l.count} visit{l.count === 1 ? '' : 's'}</div>
              </div>
              <span className="amount" style={{ fontSize: '0.85rem' }}>{formatAUD(l.total)}</span>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <h2>Spending rhythm</h2>
        <div className="row" style={{ alignItems: 'flex-end', height: 70 }}>
          {dow.map((v, i) => (
            <div key={DOW[i]} style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ height: `${(v / maxDow) * 50}px`, background: 'var(--accent)', borderRadius: 4, opacity: v === 0 ? 0.15 : 1 }} />
              <div className="txn__sub">{DOW[i]}</div>
            </div>
          ))}
        </div>
        <div className="row" style={{ marginTop: 10 }}>
          <StatCard label="Avg / day" value={formatAUD(avg.perDay)} />
          <StatCard label="Avg / spend" value={formatAUD(avg.perTxn)} />
          <StatCard label="Biggest" value={formatAUD(avg.biggest)} />
        </div>
      </div>

      {drill && (
        <CategoryDrill categoryId={drill} onClose={() => setDrill(null)} txns={mine} excluded={excluded} />
      )}
    </div>
  )
}

function CategoryDrill({ categoryId, txns, excluded, onClose }: {
  categoryId: string
  txns: Txn[]
  excluded: Set<string>
  onClose: () => void
}) {
  const { categories } = useData()
  const c = categories.find((x) => x.id === categoryId)
  const rows = txns.filter((t) => t.category_id === categoryId && t.amount < 0)
  const byMonth = new Map<string, number>()
  for (const t of rows) byMonth.set(t.txn_date.slice(0, 7), (byMonth.get(t.txn_date.slice(0, 7)) ?? 0) - t.amount)
  const months = [...byMonth.entries()].sort()
  const max = Math.max(1, ...months.map(([, v]) => v))
  const leaders = merchantLeaderboard(rows, '0000-01-01', '9999-12-31', excluded, 5)
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <h2>{c?.icon} {c?.name}</h2>
        <div className="row" style={{ alignItems: 'flex-end', height: 60 }}>
          {months.map(([m, v]) => (
            <div key={m} style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ height: `${(v / max) * 44}px`, background: c?.colour ?? 'var(--accent)', borderRadius: 3 }} />
              <div className="txn__sub">{m.slice(5)}</div>
            </div>
          ))}
        </div>
        {leaders.map((l) => (
          <div key={l.merchant} className="row--between" style={{ fontSize: '0.82rem' }}>
            <span className="muted">{l.label} × {l.count}</span>
            <span className="amount">{formatAUD(l.total)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
