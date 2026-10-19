import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { useData } from '../data/DataProvider'
import { visibleTo } from '../domain/ownership'
import { PersonSwitcher } from '../components/PersonSwitcher'
import { fetchAccounts } from '../data/accounts'
import { fetchBalanceHistory } from '../data/balanceHistory'
import { useRealtime } from '../data/useRealtime'
import { addDaysIso, formatAUD, formatDayMonth, isoToday } from '../domain/money'
import { groupNetWorth, kindInfo, netWorthHistory, signedBalance } from '../domain/netWorth'
import { AccountSheet } from '../components/AccountSheet'
import { ProgressBar } from '../components/ui/ProgressBar'
import { EmptyState } from '../components/ui/EmptyState'
import { LineChart } from '../components/ui/LineChart'
import type { Account, BalancePoint } from '../data/types'

/** Month-ends for the last n months, oldest first, ending today. */
function monthEnds(todayIso: string, n: number): string[] {
  const [y, m] = todayIso.split('-').map(Number)
  const out: string[] = []
  for (let i = n - 1; i >= 1; i--) {
    const t = y * 12 + (m - 1) - i
    const last = new Date(Date.UTC(Math.floor(t / 12), (t % 12) + 1, 0)).getUTCDate()
    out.push(`${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}-${String(last).padStart(2, '0')}`)
  }
  return [...out, todayIso]
}

const monthShort = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-AU', { month: 'short', year: '2-digit' })

export default function AccountsScreen() {
  const { user } = useAuth()
  const { viewId, readOnly } = useData()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [history, setHistory] = useState<BalancePoint[]>([])
  const [sheet, setSheet] = useState<{ account: Account | null } | null>(null)
  const today = isoToday()

  const load = useCallback(() => {
    if (!viewId) return
    fetchAccounts().then((a) => setAccounts(visibleTo(a, viewId))).catch(() => setAccounts([]))
    fetchBalanceHistory(addDaysIso(today, -400)).then(setHistory).catch(() => setHistory([]))
  }, [viewId, today])
  useEffect(load, [load])
  useRealtime(['budget_accounts', 'budget_balance_history'], load)

  const active = accounts.filter((a) => !a.is_archived)
  const nw = useMemo(() => groupNetWorth(active), [active])
  const trend = useMemo(() => {
    const ids = new Set(active.map((a) => a.id))
    const points = netWorthHistory(active, history.filter((h) => ids.has(h.account_id)), monthEnds(today, 12))
    // today's figure is the live one, even where history lags
    points[points.length - 1] = { date: today, net: nw.net }
    const firstReal = points.findIndex((p) => p.net !== 0)
    return firstReal < 0 ? [] : points.slice(firstReal)
  }, [active, history, today, nw.net])
  const change = trend.length > 1 ? trend[trend.length - 1].net - trend[0].net : 0

  return (
    <div className="screen">
      <div className="row--between">
        <h1 className="brand">Accounts</h1>
        <div className="row" style={{ gap: 8 }}>
          <PersonSwitcher />
          {!readOnly && <button className="btn btn--small" onClick={() => setSheet({ account: null })}>+ Add</button>}
        </div>
      </div>
      <div className="hero" style={{ cursor: 'default' }}>
        <div className="statcard__label">Net worth</div>
        <div className="stat">{formatAUD(nw.net)}</div>
        <div className="txn__sub">{formatAUD(nw.assets)} assets · {formatAUD(nw.liabilities)} owing</div>
        {trend.length > 1 && (
          <div className={`delta ${change >= 0 ? 'amount--pos' : 'error'}`}>
            {change >= 0 ? '▲' : '▼'} {formatAUD(Math.abs(change))} since {monthShort(trend[0].date)}
          </div>
        )}
      </div>

      {trend.length > 2 && (
        <div className="card">
          <h2>Net worth · last 12 months</h2>
          <LineChart label="Net worth by month" points={trend.map((p) => ({ x: p.date, y: p.net }))} formatX={monthShort} formatY={formatAUD} height={140} zeroBased={false} />
        </div>
      )}

      {nw.groups.map((g) => {
        const info = kindInfo(g.kind)
        return (
          <div key={g.kind} className="card">
            <div className="row--between">
              <h2>{info.icon} {info.label}</h2>
              <span className={`txn__sub amount ${g.total < 0 ? 'error' : ''}`}>{formatAUD(g.total)}</span>
            </div>
            {g.accounts.map((a) => (
              <div key={a.id} style={{ marginBottom: 6 }}>
                <button className="account-row" disabled={readOnly} onClick={() => setSheet({ account: a })}>
                  <div className="txn__main">
                    <div className="txn__desc">{a.name}{a.owner_id === null && <> <span className="badge">Joint</span></>}</div>
                    <div className="txn__sub">{a.balance_as_of ? `as at ${formatDayMonth(a.balance_as_of)}` : readOnly ? 'no balance yet' : 'no balance yet — tap to set'}</div>
                  </div>
                  <span className="amount">{a.balance != null ? formatAUD(signedBalance(a)) : '—'}</span>
                </button>
                {a.goal_amount != null && a.goal_amount > 0 && (
                  <div style={{ padding: '6px 2px 10px' }}>
                    <ProgressBar value={a.balance ?? 0} max={a.goal_amount} />
                    <div className="txn__sub">{formatAUD(a.balance ?? 0)} of {formatAUD(a.goal_amount)} goal ({Math.min(100, Math.round(((a.balance ?? 0) / a.goal_amount) * 100))}%)</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      })}
      {active.length === 0 && <EmptyState icon="🏦" title="No accounts yet" hint={readOnly ? undefined : 'Import a statement or add one by hand.'} />}
      <p className="txn__sub" style={{ whiteSpace: 'normal' }}>
        Bank balances update automatically when you import statements with a balance column. Add super, investments, property and loans by hand for the full picture — update them now and then and the chart fills in.
      </p>
      {sheet && user && (
        <AccountSheet account={sheet.account} userId={user.id} onClose={() => setSheet(null)} onSaved={() => { setSheet(null); load() }} />
      )}
    </div>
  )
}
