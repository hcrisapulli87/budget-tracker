import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useData } from '../data/DataProvider'
import { fetchTransactions } from '../data/transactions'
import { fetchSubscriptions } from '../data/subscriptions'
import { fetchAccounts } from '../data/accounts'
import { useRealtime } from '../data/useRealtime'
import { summarise } from '../domain/analytics'
import { buildInsights } from '../domain/insights'
import { budgetPace } from '../domain/budgetMath'
import { rangeBounds } from '../domain/stats'
import { visibleTo } from '../domain/ownership'
import { buildRecurring, countdown, dueBetween } from '../domain/recurring'
import { fetchBills } from '../data/bills'
import { formatAUD, formatDayMonth, isoToday, addDaysIso } from '../domain/money'
import { IconCircle } from '../components/ui/IconCircle'
import { ProgressBar } from '../components/ui/ProgressBar'
import { PersonAvatar } from '../components/ui/PersonAvatar'
import { PersonSwitcher } from '../components/PersonSwitcher'
import type { Account, Bill, Subscription, Txn } from '../data/types'

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

const QUICK_LINKS = [
  { to: '/trends', icon: '📈', label: 'Trends' },
  { to: '/tax', icon: '🧮', label: 'Tax' },
  { to: '/import', icon: '⤓', label: 'Import' },
  { to: '/settings', icon: '⚙️', label: 'Settings' },
]

export default function Dashboard() {
  const { categories, budgets, me, viewing, viewId, readOnly } = useData()
  const navigate = useNavigate()
  const [txns, setTxns] = useState<Txn[]>([])
  const [subs, setSubs] = useState<Subscription[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [bills, setBills] = useState<Bill[]>([])
  const today = isoToday()
  const month = today.slice(0, 7)
  const prevMonth = shift(month, -1)

  const load = useCallback(() => {
    if (!viewId) return
    fetchTransactions(`${shift(month, -3)}-01`, monthBounds(month).to, viewId).then(setTxns).catch(() => setTxns([]))
    fetchSubscriptions().then((s) => setSubs(s.filter((x) => x.owner_id === viewId))).catch(() => setSubs([]))
    fetchAccounts().then((a) => setAccounts(visibleTo(a, viewId))).catch(() => setAccounts([]))
    fetchBills().then((b) => setBills(visibleTo(b, viewId))).catch(() => setBills([]))
  }, [month, viewId])
  useEffect(load, [load])
  useRealtime(['budget_transactions', 'budget_subscriptions', 'budget_accounts', 'budget_budgets', 'budget_bills'], load)

  const excluded = useMemo(
    () => new Set(categories.filter((c) => c.exclude_from_analytics).map((c) => c.id)),
    [categories],
  )
  const mine = txns // already just the viewed person's
  const cur = useMemo(() => summarise(mine, monthBounds(month).from, monthBounds(month).to, excluded), [mine, month, excluded])
  const week = rangeBounds('week', today)
  const weekSum = useMemo(() => summarise(mine, week.from, week.to, excluded), [mine, week.from, week.to, excluded])

  const dayOfMonth = Number(today.slice(8, 10))
  const prevToSameDay = useMemo(() => summarise(mine, `${prevMonth}-01`, addDaysIso(`${prevMonth}-01`, dayOfMonth - 1), excluded), [mine, prevMonth, dayOfMonth, excluded])
  const delta = cur.spend - prevToSameDay.spend

  // the hero: last 3 calendar months, this one so far
  const last3 = useMemo(
    () => [shift(month, -2), shift(month, -1), month].map((m) => {
      const { from, to } = monthBounds(m)
      return { month: m, ...summarise(mine, from, to, excluded) }
    }),
    [mine, month, excluded],
  )
  const total3 = last3.reduce((sum, m) => sum + m.spend, 0)
  const income3 = last3.reduce((sum, m) => sum + m.income, 0)
  const fullMonthAvg = (last3[0].spend + last3[1].spend) / 2
  const maxMonth = Math.max(1, ...last3.map((m) => m.spend))
  const monthName = (m: string) => new Date(`${m}-01T00:00:00`).toLocaleDateString('en-AU', { month: 'short' })

  const netWorth = accounts.filter((a) => !a.is_archived).reduce((s, a) => s + (a.balance ?? 0), 0)
  const cat = (id: string | null) => categories.find((c) => c.id === id)
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  // the viewed person's spend this month, against their own budgets
  const monthTxns = useMemo(() => {
    const { from, to } = monthBounds(month)
    return txns.filter((t) => t.txn_date >= from && t.txn_date <= to)
  }, [txns, month])
  const daysInMonth = Number(monthBounds(month).to.slice(8, 10))
  const topBudgets = useMemo(() => {
    return budgets
      .map((b) => {
        const spent = monthTxns
          .filter((t) => t.category_id === b.category_id && t.amount < 0)
          .reduce((s, t) => s - t.amount, 0)
        return { ...b, spent, used: b.monthly_limit > 0 ? spent / b.monthly_limit : 0 }
      })
      .sort((a, b) => b.used - a.used)
      .slice(0, 3)
  }, [budgets, monthTxns])

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

  // categories Tally guessed (or couldn't) this month that you haven't confirmed
  const toReview = useMemo(
    () => mine.filter((t) => !t.category_confirmed && t.txn_date >= `${month}-01`).length,
    [mine, month],
  )

  // next fortnight of bills + subscriptions
  const comingUp = useMemo(
    () => dueBetween(buildRecurring(bills, subs), '0000-01-01', addDaysIso(today, 14)).slice(0, 4),
    [bills, subs, today],
  )

  // this month's biggest categories vs the same days last month
  const topCats = useMemo(() => {
    const prev = new Map(prevToSameDay.byCategory.map((c) => [c.categoryId, c.total]))
    return cur.byCategory.slice(0, 4).map((c) => ({ ...c, delta: c.total - (prev.get(c.categoryId) ?? 0) }))
  }, [cur, prevToSameDay])

  return (
    <div className="screen">
      <div className="home-top">
        <span className="txn__sub">{formatDayMonth(today)}</span>
        <div className="home-top__actions">
          <PersonSwitcher />
          {!readOnly && <Link className="header-add" to="/add" aria-label="Add transaction">＋</Link>}
          <Link to="/settings" aria-label="Settings" style={{ textDecoration: 'none', display: 'flex' }}>
            {me ? <PersonAvatar name={me.display_name} isMe size={40} /> : <span className="gear">⚙️</span>}
          </Link>
        </div>
      </div>
      <p className="greeting home-greeting">{greeting}{me ? `, ${me.display_name}` : ''}</p>

      <div className="hero hero--tint">
        <div className="hero__label">Spent · last 3 months{readOnly && viewing ? ` · ${viewing.display_name}` : ''}</div>
        <div className="stat">{formatAUD(total3)}</div>
        <div className="txn__sub" style={{ whiteSpace: 'normal' }}>
          ~{formatAUD(fullMonthAvg)}/month · {formatAUD(income3)} in
        </div>
        <div className="months3" aria-label="Spending by month">
          {last3.map((m) => (
            <div key={m.month} className={`months3__col${m.month === month ? ' months3__col--now' : ''}`}>
              <div className="months3__amt">{formatAUD(m.spend)}</div>
              <div className="months3__bar" style={{ height: `${(m.spend / maxMonth) * 70}%` }} />
              <div className="months3__label">{monthName(m.month)}{m.month === month ? ' so far' : ''}</div>
            </div>
          ))}
        </div>
        <div className={`delta ${delta <= 0 ? 'amount--pos' : 'error'}`} style={{ marginTop: 10 }}>
          {delta <= 0 ? '▼' : '▲'} {formatAUD(Math.abs(delta))} vs {monthName(prevMonth)} at this point
        </div>
      </div>

      {!readOnly && toReview > 0 && (
        <Link to="/transactions?review=1" className="card card--tint row--between" style={{ textDecoration: 'none', color: 'inherit' }}>
          <span>✨ <strong>{toReview}</strong> transaction{toReview === 1 ? '' : 's'} to check this month</span>
          <span className="txn__sub">review →</span>
        </Link>
      )}

      <button className="statcard" style={{ width: '100%', textAlign: 'left', cursor: 'pointer' }} onClick={() => navigate('/accounts')}>
        <div className="statcard__label">Net worth · {readOnly ? 'their' : 'your'} accounts</div>
        <div className="statcard__value" style={{ fontSize: '1.5rem' }}>{formatAUD(netWorth)}</div>
        <div className="statcard__sub">Spent this week: {formatAUD(weekSum.spend)} · tap for accounts & goals</div>
      </button>

      <div className="quicklinks" style={{ marginTop: 14 }}>
        {QUICK_LINKS.map((q) => (
          <Link key={q.to} to={q.to} className="quicklink">
            <span className="icon">{q.icon}</span>
            {q.label}
          </Link>
        ))}
      </div>

      {topBudgets.length > 0 && (
        <div className="card">
          <div className="row--between">
            <h2>Budgets</h2>
            <Link to="/budgets" className="txn__sub">all →</Link>
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

      {comingUp.length > 0 && (
        <div className="card">
          <div className="row--between">
            <h2>Coming up</h2>
            <Link to="/recurring" className="txn__sub">all →</Link>
          </div>
          {comingUp.map((i) => (
            <div key={`${i.kind}-${i.id}`} className="row--between" style={{ fontSize: '0.85rem', marginBottom: 6 }}>
              <span>{i.name}{i.joint && <> <span className="badge">Joint</span></>}</span>
              <span className={i.next && i.next < today ? 'error' : 'muted'}>
                {formatAUD(i.amount)} · {i.next ? countdown(i.next, today) : ''}
              </span>
            </div>
          ))}
        </div>
      )}

      {topCats.length > 0 && (
        <div className="card">
          <div className="row--between">
            <h2>Where it went</h2>
            <Link to="/trends" className="txn__sub">trends →</Link>
          </div>
          {topCats.map((c) => (
            <div key={c.categoryId ?? 'none'} className="txn">
              <IconCircle icon={cat(c.categoryId)?.icon ?? '❓'} colour={cat(c.categoryId)?.colour ?? '#8ba59a'} size={28} />
              <div className="txn__main">
                <div className="txn__desc" style={{ fontSize: '0.88rem' }}>{cat(c.categoryId)?.name ?? 'Uncategorised'}</div>
                <div className="txn__sub" style={c.delta > 0 ? { color: 'var(--warn)' } : undefined}>{c.delta >= 0 ? '▲' : '▼'} {formatAUD(Math.abs(c.delta))} vs last month</div>
              </div>
              <span className="amount" style={{ fontSize: '0.88rem' }}>{formatAUD(c.total)}</span>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <div className="row--between">
          <h2>Recent</h2>
          <Link to="/transactions" className="txn__sub">all →</Link>
        </div>
        {recent.map((t) => (
          <div key={t.id} className="txn">
            <IconCircle icon={cat(t.category_id)?.icon ?? '❓'} colour={cat(t.category_id)?.colour ?? '#8ba59a'} size={32} />
            <div className="txn__main">
              <div className="txn__desc" style={{ fontSize: '0.9rem' }}>{t.description}</div>
              <div className="txn__sub">{formatDayMonth(t.txn_date)} · {t.account}</div>
            </div>
            <span className={`amount ${t.amount < 0 ? 'amount--neg' : 'amount--pos'}`} style={{ fontSize: '0.9rem' }}>{formatAUD(t.amount)}</span>
          </div>
        ))}
        {recent.length === 0 && <p className="muted">{readOnly ? 'Nothing here yet.' : 'Tap ＋ to add your first spend.'}</p>}
      </div>

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
