import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { useData } from '../data/DataProvider'
import { fetchTransactions } from '../data/transactions'
import { fetchSubscriptions } from '../data/subscriptions'
import { fetchAccounts } from '../data/accounts'
import { useRealtime } from '../data/useRealtime'
import { useWho } from '../lib/useWho'
import { summarise } from '../domain/analytics'
import { buildInsights } from '../domain/insights'
import { budgetPace } from '../domain/budgetMath'
import { rangeBounds } from '../domain/stats'
import { formatAUD, formatDayMonth, isoToday, addDaysIso } from '../domain/money'
import { IconCircle } from '../components/ui/IconCircle'
import { ProgressBar } from '../components/ui/ProgressBar'
import { SegmentedControl } from '../components/ui/SegmentedControl'
import type { Account, Subscription, Txn } from '../data/types'

function shift(iso: string, delta: number): string {
  const [y, m] = iso.split('-').map(Number)
  const t = y * 12 + (m - 1) + delta
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`
}
function monthBounds(iso: string): { from: string; to: string } {
  const [y, m] = iso.split('-').map(Number)
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return { from: `${iso}-01`, to: `${iso}-${String(last).padStart(2, '0')}` }
}

export default function Dashboard() {
  const { user } = useAuth()
  const { categories, budgets, profiles } = useData()
  const navigate = useNavigate()
  const [txns, setTxns] = useState<Txn[]>([])
  const [subs, setSubs] = useState<Subscription[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [who, setWho] = useWho()
  const today = isoToday()
  const month = today.slice(0, 7)
  const prevMonth = shift(month, -1)

  const load = useCallback(() => {
    fetchTransactions(`${shift(month, -3)}-01`, monthBounds(month).to).then(setTxns).catch(() => setTxns([]))
    fetchSubscriptions().then(setSubs).catch(() => setSubs([]))
    fetchAccounts().then(setAccounts).catch(() => setAccounts([]))
  }, [month])
  useEffect(load, [load])
  useRealtime(['budget_transactions', 'budget_subscriptions', 'budget_accounts', 'budget_budgets'], load)

  const excluded = useMemo(
    () => new Set(categories.filter((c) => c.exclude_from_analytics).map((c) => c.id)),
    [categories],
  )
  const mine = useMemo(() => (who === 'all' ? txns : txns.filter((t) => t.owner_id === user?.id)), [txns, who, user])
  const cur = useMemo(() => summarise(mine, monthBounds(month).from, monthBounds(month).to, excluded), [mine, month, excluded])
  const week = rangeBounds('week', today)
  const weekSum = useMemo(() => summarise(mine, week.from, week.to, excluded), [mine, week.from, week.to, excluded])

  const dayOfMonth = Number(today.slice(8, 10))
  const prevToSameDay = summarise(mine, `${prevMonth}-01`, addDaysIso(`${prevMonth}-01`, dayOfMonth - 1), excluded)
  const delta = cur.spend - prevToSameDay.spend
  const maxDay = Math.max(1, ...cur.byDay.map((d) => d.spend))

  const netWorth = accounts.filter((a) => !a.is_archived).reduce((s, a) => s + (a.balance ?? 0), 0)
  const cat = (id: string | null) => categories.find((c) => c.id === id)
  const me = profiles.find((p) => p.id === user?.id)
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  // household spend for budgets (never person-filtered)
  const householdMonth = useMemo(() => {
    const { from, to } = monthBounds(month)
    return txns.filter((t) => t.txn_date >= from && t.txn_date <= to)
  }, [txns, month])
  const daysInMonth = Number(monthBounds(month).to.slice(8, 10))
  const topBudgets = useMemo(() => {
    return budgets
      .map((b) => {
        const spent = householdMonth
          .filter((t) => t.category_id === b.category_id && t.amount < 0)
          .reduce((s, t) => s - t.amount, 0)
        return { ...b, spent, used: b.monthly_limit > 0 ? spent / b.monthly_limit : 0 }
      })
      .sort((a, b) => b.used - a.used)
      .slice(0, 3)
  }, [budgets, householdMonth])

  const monthly = useMemo(() => {
    const months = [shift(month, -3), shift(month, -2), shift(month, -1), month]
    const byCat = new Map<string, number[]>()
    months.forEach((m, idx) => {
      const s = summarise(mine, monthBounds(m).from, monthBounds(m).to, excluded)
      for (const c of s.byCategory) {
        if (!c.categoryId) continue
        const arr = byCat.get(c.categoryId) ?? [0, 0, 0, 0]
        arr[idx] = c.total
        byCat.set(c.categoryId, arr)
      }
    })
    return [...byCat.entries()].map(([categoryId, totals]) => ({ categoryId, totals }))
  }, [mine, month, excluded])

  const observations = useMemo(
    () => buildInsights({
      categoryNames: new Map(categories.map((c) => [c.id, c.name])),
      monthlyByCategory: monthly,
      subs,
      today,
    }).slice(0, 2),
    [monthly, subs, categories, today],
  )

  const recent = mine.slice(0, 5)

  return (
    <div className="screen">
      <div className="row--between">
        <div>
          <p className="greeting">{greeting}{me ? `, ${me.display_name}` : ''}</p>
          <p className="txn__sub">{formatDayMonth(today)}</p>
        </div>
        <div className="row" style={{ gap: 10 }}>
          <Link className="header-add" to="/add" aria-label="Add transaction">＋</Link>
          <Link className="gear" to="/settings" aria-label="Settings">⚙️</Link>
        </div>
      </div>
      <div className="row" style={{ margin: '8px 0' }}>
        <SegmentedControl options={[{ value: 'mine', label: 'Me' }, { value: 'all', label: 'Both' }]} value={who} onChange={setWho} />
      </div>

      <button className="hero" onClick={() => navigate('/accounts')}>
        <div className="statcard__label">Net worth · all accounts</div>
        <div className="stat">{formatAUD(netWorth)}</div>
        <div className="txn__sub">Spent this week: {formatAUD(weekSum.spend)} · tap for accounts & goals</div>
      </button>

      <div className="card">
        <h2>This month</h2>
        <div className="stat">{formatAUD(cur.spend)}</div>
        <div className="muted">spent · {formatAUD(cur.income)} in</div>
        <div className={`delta ${delta <= 0 ? 'amount--pos' : 'error'}`}>
          {delta <= 0 ? '▼' : '▲'} {formatAUD(Math.abs(delta))} vs last month to the same day
        </div>
        <svg viewBox={`0 0 ${cur.byDay.length * 6} 40`} width="100%" height="40" preserveAspectRatio="none" aria-label="Daily spending">
          {cur.byDay.map((d, i) => (
            <rect key={d.date} x={i * 6} y={40 - (d.spend / maxDay) * 38} width="4" height={(d.spend / maxDay) * 38} fill="#3ddc84" rx="1" />
          ))}
        </svg>
      </div>

      {topBudgets.length > 0 && (
        <div className="card">
          <div className="row--between">
            <h2>Budgets</h2>
            <Link to="/insights" className="txn__sub">all →</Link>
          </div>
          {topBudgets.map((b) => {
            const c = cat(b.category_id)
            const pace = budgetPace(b.spent, b.monthly_limit, dayOfMonth, daysInMonth)
            return (
              <div key={b.id} style={{ marginBottom: 10 }}>
                <div className="row--between" style={{ fontSize: '0.85rem' }}>
                  <span>{c?.icon} {c?.name}</span>
                  <span className={pace.status === 'over' ? 'error' : pace.status === 'hot' ? 'warn' : 'muted'}>
                    {formatAUD(b.spent)} of {formatAUD(b.monthly_limit)}
                  </span>
                </div>
                <ProgressBar value={b.spent} max={b.monthly_limit} markerAt={pace.expected}
                  tone={pace.status === 'over' ? 'over' : pace.status === 'hot' ? 'warn' : 'ok'} />
              </div>
            )
          })}
        </div>
      )}

      <div className="card">
        <div className="row--between">
          <h2>Recent</h2>
          <Link to="/transactions" className="txn__sub">all →</Link>
        </div>
        {recent.map((t) => (
          <div key={t.id} className="txn">
            <IconCircle icon={cat(t.category_id)?.icon ?? '❓'} colour={cat(t.category_id)?.colour ?? '#8ba59a'} size={30} />
            <div className="txn__main">
              <div className="txn__desc" style={{ fontSize: '0.85rem' }}>{t.description}</div>
              <div className="txn__sub">{formatDayMonth(t.txn_date)}</div>
            </div>
            <span className={`amount ${t.amount < 0 ? 'amount--neg' : 'amount--pos'}`} style={{ fontSize: '0.85rem' }}>{formatAUD(t.amount)}</span>
          </div>
        ))}
        {recent.length === 0 && <p className="muted">Tap ＋ to add your first spend.</p>}
      </div>

      <Link to="/tax" className="card row--between" style={{ textDecoration: 'none', color: 'inherit' }}>
        <span>🧾 Tax records</span>
        <span className="txn__sub">EOFY records & checklist →</span>
      </Link>

      {observations.length > 0 && (
        <div className="card">
          <h2>Worth a look <span className="badge">observations, not verdicts</span></h2>
          {observations.map((i, idx) => (
            <p key={idx} className="txn__sub" style={{ whiteSpace: 'normal' }}>{i.message}</p>
          ))}
        </div>
      )}
    </div>
  )
}
