import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { useData } from '../data/DataProvider'
import { fetchTransactions } from '../data/transactions'
import { useRealtime } from '../data/useRealtime'
import { summarise } from '../domain/analytics'
import { formatAUD, isoToday, addDaysIso } from '../domain/money'
import type { Txn } from '../data/types'

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
  const [who, setWho] = useState<'all' | 'mine'>('all')
  const month = isoToday().slice(0, 7)
  const prevMonth = shift(month, -1)

  const load = useCallback(() => {
    fetchTransactions(`${prevMonth}-01`, monthBounds(month).to).then(setTxns).catch(() => setTxns([]))
  }, [month, prevMonth])
  useEffect(load, [load])
  useRealtime(['budget_transactions'], load)

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
    </div>
  )
}
