import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { fetchAccounts } from '../data/accounts'
import { useRealtime } from '../data/useRealtime'
import { formatAUD, formatDayMonth } from '../domain/money'
import { AccountSheet } from '../components/AccountSheet'
import { ProgressBar } from '../components/ui/ProgressBar'
import { EmptyState } from '../components/ui/EmptyState'
import type { Account } from '../data/types'

export default function AccountsScreen() {
  const { user } = useAuth()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [sheet, setSheet] = useState<{ account: Account | null } | null>(null)

  const load = useCallback(() => {
    fetchAccounts().then(setAccounts).catch(() => setAccounts([]))
  }, [])
  useEffect(load, [load])
  useRealtime(['budget_accounts'], load)

  const active = accounts.filter((a) => !a.is_archived)
  const total = active.reduce((s, a) => s + (a.balance ?? 0), 0)

  return (
    <div className="screen">
      <div className="row--between">
        <h1 className="brand">Accounts</h1>
        <button className="btn btn--small" onClick={() => setSheet({ account: null })}>+ Add</button>
      </div>
      <div className="hero" style={{ cursor: 'default' }}>
        <div className="statcard__label">Net worth</div>
        <div className="stat">{formatAUD(total)}</div>
      </div>
      <div className="card">
        {active.map((a) => (
          <div key={a.id} style={{ marginBottom: 6 }}>
            <button className="account-row" onClick={() => setSheet({ account: a })}>
              <div className="txn__main">
                <div className="txn__desc">{a.name}</div>
                <div className="txn__sub">{a.balance_as_of ? `as at ${formatDayMonth(a.balance_as_of)}` : 'no balance yet — tap to set'}</div>
              </div>
              <span className="amount">{a.balance != null ? formatAUD(a.balance) : '—'}</span>
            </button>
            {a.goal_amount != null && a.goal_amount > 0 && (
              <div style={{ padding: '6px 2px 10px' }}>
                <ProgressBar value={a.balance ?? 0} max={a.goal_amount} />
                <div className="txn__sub">{formatAUD(a.balance ?? 0)} of {formatAUD(a.goal_amount)} goal ({Math.min(100, Math.round(((a.balance ?? 0) / a.goal_amount) * 100))}%)</div>
              </div>
            )}
          </div>
        ))}
        {active.length === 0 && <EmptyState icon="🏦" title="No accounts yet" hint="Import a statement or add one by hand." />}
      </div>
      <p className="txn__sub" style={{ whiteSpace: 'normal' }}>
        Balances update automatically when you import statements with a balance column; goals fill in as balances rise.
      </p>
      {sheet && user && (
        <AccountSheet account={sheet.account} userId={user.id} onClose={() => setSheet(null)} onSaved={() => { setSheet(null); load() }} />
      )}
    </div>
  )
}
