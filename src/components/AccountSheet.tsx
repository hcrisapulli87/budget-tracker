import { useState } from 'react'
import { createAccount, updateAccount } from '../data/accounts'
import { isoToday } from '../domain/money'
import type { Account } from '../data/types'

interface Props {
  account: Account | null // null = create a new one
  userId: string
  onClose: () => void
  onSaved: () => void
}

export function AccountSheet({ account, userId, onClose, onSaved }: Props) {
  const [name, setName] = useState(account?.name ?? '')
  const [balance, setBalance] = useState(account?.balance != null ? String(account.balance) : '')
  const [busy, setBusy] = useState(false)

  const save = async () => {
    const trimmed = name.trim()
    const value = balance.trim() === '' ? null : Number(balance)
    if (!trimmed || (value !== null && !Number.isFinite(value))) return
    setBusy(true)
    try {
      if (account) {
        const balanceChanged = value !== account.balance
        await updateAccount(account.id, {
          name: trimmed,
          // manual balance edits stamp today; untouched balances keep their import date
          ...(balanceChanged ? { balance: value, balance_as_of: value === null ? null : isoToday() } : {}),
        })
      } else {
        await createAccount(trimmed, userId, value, isoToday())
      }
      onSaved()
    } finally {
      setBusy(false)
    }
  }

  const archive = async () => {
    if (!account) return
    setBusy(true)
    try {
      await updateAccount(account.id, { is_archived: true })
      onSaved()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <h2>{account ? 'Edit account' : 'Add account'}</h2>
        <input className="input" placeholder='Name, e.g. "NAB Savings"' value={name} onChange={(e) => setName(e.target.value)} />
        <input
          className="input"
          type="number"
          inputMode="decimal"
          placeholder="Current balance (optional)"
          value={balance}
          onChange={(e) => setBalance(e.target.value)}
        />
        <p className="txn__sub">Balances update themselves whenever you import a statement with a balance column.</p>
        <button className="btn btn--primary" disabled={busy} onClick={() => void save()}>Save</button>
        {account && (
          <button className="btn" disabled={busy} onClick={() => void archive()}>Archive account</button>
        )}
      </div>
    </div>
  )
}
