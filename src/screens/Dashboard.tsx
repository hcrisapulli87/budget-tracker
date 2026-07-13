import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { useData } from '../data/DataProvider'
import { fetchTransactions } from '../data/transactions'
import { fetchSubscriptions } from '../data/subscriptions'
import { fetchAccounts } from '../data/accounts'
import { useRealtime } from '../data/useRealtime'
import { summarise } from '../domain/analytics'
import { buildInsights } from '../domain/insights'
import { formatAUD, isoToday, addDaysIso } from '../domain/money'
import { AccountSheet } from '../components/AccountSheet'
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
  const { categories } = useData()
  const [txns, setTxns] = useState<Txn[]>([])
  const [subs, setSubs] = useState<Subscription[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [accountSheet, setAccountSheet] = useState<{ account: Account | null } | null>(null)
  const [who, setWho] = useState<'all' | 'mine'>('all')
  const month = isoToday().slice(0, 7)
  const prevMonth = shift(month, -1)

  const load = useCallback(() => {
    // 4 months back feeds the spike insight's 3-month rolling average.
    fetchTransactions(`${shift(month, -3)}-01`, monthBounds(month).to).then(setTxns).catch(() => setTxns([]))
    fetchSubscriptions().then(setSubs).catch(() => setSubs([]))
    fetchAccounts().then(setAccounts).catch(() => setAccounts([]))
  }, [month])
  useEffect(load, [load])
  useRealtime(['budget_transactions', 'budget_subscriptions', 'budget_accounts'], load)

  const activeAccounts = accounts.filter((a) => !a.is_archived)
  const balanceTotal = activeAccounts.reduce((sum, a) => sum + (a.balance ?? 0), 0)

  const mine = useMemo(
    () => (who === 'all' ? txns : txns.filter((t) => t.owner_id === user?.id)),
    [txns, who, user],
  )
  const cur = useMemo(() => summarise(mine, monthBounds(month).from, monthBounds(month).to), [mine, month])

  const cat = (id: string | null) => categories.find((c) => c.id === id)
  const maxCat = cur.byCategory[0]?.total ?? 1
  const maxDay = Math.max(1, ...cur.byDay.map((d) => d.spend))
  // Same-point-in-month comparison, so mid-month isn't always "under".
  const dayOfMonth = Number(isoToday().slice(8, 10))
  const prevToSameDay = summarise(mine, `${prevMonth}-01`, addDaysIso(`${prevMonth}-01`, dayOfMonth - 1))
  const delta = cur.spend - prevToSameDay.spend

  const monthly = useMemo(() => {
    const months = [shift(month, -3), shift(month, -2), shift(month, -1), month]
    const byCat = new Map<string, number[]>()
    months.forEach((m, idx) => {
      const s = summarise(mine, monthBounds(m).from, monthBounds(m).to)
      for (const c of s.byCategory) {
        if (!c.categoryId) continue
        const arr = byCat.get(c.categoryId) ?? [0, 0, 0, 0]
        arr[idx] = c.total
        byCat.set(c.categoryId, arr)
      }
    })
    return [...byCat.entries()].map(([categoryId, totals]) => ({ categoryId, totals }))
  }, [mine, month])

  const insights = useMemo(
    () =>
      buildInsights({
        categoryNames: new Map(categories.map((c) => [c.id, c.name])),
        monthlyByCategory: monthly,
        subs,
        today: isoToday(),
      }),
    [monthly, subs, categories],
  )

  return (
    <div className="screen">
      <div className="row--between">
        <h1 className="brand">Tally</h1>
        <Link to="/settings" aria-label="Settings">⚙️</Link>
      </div>
      <div className="row">
        <select className="input" value={who} onChange={(e) => setWho(e.target.value as 'all' | 'mine')}>
          <option value="all">Both of us</option>
          <option value="mine">Just me</option>
        </select>
      </div>

      <div className="card">
        <div className="row--between">
          <h2>Accounts</h2>
          <button className="btn btn--small" onClick={() => setAccountSheet({ account: null })}>+ Add</button>
        </div>
        {activeAccounts.map((a) => (
          <button key={a.id} className="account-row" onClick={() => setAccountSheet({ account: a })}>
            <div className="txn__main">
              <div className="txn__desc">{a.name}</div>
              <div className="txn__sub">{a.balance_as_of ? `as at ${a.balance_as_of}` : 'no balance yet — tap to set'}</div>
            </div>
            <span className="amount">{a.balance != null ? formatAUD(a.balance) : '—'}</span>
          </button>
        ))}
        {activeAccounts.length === 0 && (
          <p className="muted">Import a statement (or add an account) and balances show up here.</p>
        )}
        {activeAccounts.length > 1 && (
          <div className="row--between total-row">
            <strong>Total</strong>
            <span className="amount stat--small">{formatAUD(balanceTotal)}</span>
          </div>
        )}
      </div>

      <div className="card">
        <h2>This month</h2>
        <div className="row--between">
          <div>
            <div className="stat">{formatAUD(cur.spend)}</div>
            <div className="muted">spent · {formatAUD(cur.income)} in</div>
          </div>
          <div className={delta <= 0 ? 'amount--pos' : 'error'}>
            {delta <= 0 ? '▼' : '▲'} {formatAUD(Math.abs(delta))} vs last month (to same day)
          </div>
        </div>
        <svg viewBox={`0 0 ${cur.byDay.length * 6} 40`} width="100%" height="40" preserveAspectRatio="none" aria-label="Daily spending">
          {cur.byDay.map((d, i) => (
            <rect key={d.date} x={i * 6} y={40 - (d.spend / maxDay) * 38} width="4" height={(d.spend / maxDay) * 38} fill="#2fbf71" rx="1" />
          ))}
        </svg>
      </div>

      <div className="card">
        <h2>By category</h2>
        {cur.byCategory.map((c) => (
          <div key={c.categoryId ?? 'none'} className="row" style={{ marginBottom: 6 }}>
            <span style={{ width: 130, fontSize: '0.85rem' }}>
              {cat(c.categoryId) ? `${cat(c.categoryId)!.icon} ${cat(c.categoryId)!.name}` : '❓ Uncategorised'}
            </span>
            <div className="bar" style={{ width: `${(c.total / maxCat) * 55}%`, background: cat(c.categoryId)?.colour ?? '#9aa5b1' }} />
            <span className="txn__sub amount">{formatAUD(c.total)}</span>
          </div>
        ))}
        {cur.byCategory.length === 0 && <p className="muted">Nothing yet this month.</p>}
        <p className="txn__sub">Categories are best guesses until you confirm them in Activity.</p>
      </div>

      {accountSheet && user && (
        <AccountSheet
          account={accountSheet.account}
          userId={user.id}
          onClose={() => setAccountSheet(null)}
          onSaved={() => { setAccountSheet(null); load() }}
        />
      )}

      {insights.length > 0 && (
        <div className="card">
          <h2>Worth a look <span className="badge">observations, not verdicts</span></h2>
          <ul className="list-plain">
            {insights.map((i, idx) => (
              <li key={idx} className="txn">
                <div className="txn__main">
                  <div className="txn__desc">{i.message}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
