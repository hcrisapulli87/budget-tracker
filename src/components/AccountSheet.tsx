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

/** "062-692" / "062 692" / "062692" → "062692"; empty → null. */
export function normaliseBsb(raw: string): string | null {
  const digits = raw.replace(/\D/g, '')
  return digits === '' ? null : digits
}

/** Account numbers keep leading zeros — digits only, stored as text. */
export function normaliseAccountNumber(raw: string): string | null {
  const digits = raw.replace(/\D/g, '')
  return digits === '' ? null : digits
}

export function AccountSheet({ account, userId, onClose, onSaved }: Props) {
  const [name, setName] = useState(account?.name ?? '')
  const [balance, setBalance] = useState(account?.balance != null ? String(account.balance) : '')
  const [goal, setGoal] = useState(account?.goal_amount != null ? String(account.goal_amount) : '')
  const [bsb, setBsb] = useState(account?.bsb ?? '')
  const [acctNo, setAcctNo] = useState(account?.account_number ?? '')
  const [busy, setBusy] = useState(false)

  const bsbDigits = normaliseBsb(bsb)
  const bsbOdd = bsbDigits !== null && bsbDigits.length !== 6

  const save = async () => {
    const trimmed = name.trim()
    const value = balance.trim() === '' ? null : Number(balance)
    const goalValue = goal.trim() === '' ? null : Number(goal)
    if (!trimmed || (value !== null && !Number.isFinite(value))) return
    if (goalValue !== null && !Number.isFinite(goalValue)) return
    setBusy(true)
    try {
      if (account) {
        const balanceChanged = value !== account.balance
        await updateAccount(account.id, {
          name: trimmed,
          goal_amount: goalValue,
          bsb: bsbDigits,
          account_number: normaliseAccountNumber(acctNo),
          // manual balance edits stamp today; untouched balances keep their import date
          ...(balanceChanged ? { balance: value, balance_as_of: value === null ? null : isoToday() } : {}),
        })
      } else {
        await createAccount(trimmed, userId, value, isoToday(), goalValue, bsbDigits, normaliseAccountNumber(acctNo))
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
        <input className="input" type="number" inputMode="decimal" placeholder="Savings goal (optional)" value={goal} onChange={(e) => setGoal(e.target.value)} />
        <input className="input" inputMode="numeric" placeholder="BSB (optional, e.g. 062-692)" value={bsb} onChange={(e) => setBsb(e.target.value)} />
        {bsbOdd && <p className="txn__sub">BSBs are usually 6 digits — double-check this one.</p>}
        <input className="input" inputMode="numeric" placeholder="Account number (optional)" value={acctNo} onChange={(e) => setAcctNo(e.target.value)} />
        <p className="txn__sub">BSB + account number let a combined multi-account CSV route rows here automatically. Balances update themselves whenever you import a statement with a balance column.</p>
        <button className="btn btn--primary" disabled={busy} onClick={() => void save()}>Save</button>
        {account && (
          <button className="btn" disabled={busy} onClick={() => void archive()}>Archive account</button>
        )}
      </div>
    </div>
  )
}
