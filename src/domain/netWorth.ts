import type { Account, AccountKind, BalancePoint } from '../data/types'

export const ACCOUNT_KINDS: { value: AccountKind; label: string; icon: string; liability: boolean }[] = [
  { value: 'bank', label: 'Everyday', icon: '💳', liability: false },
  { value: 'savings', label: 'Savings', icon: '🐖', liability: false },
  { value: 'super', label: 'Super', icon: '🧓', liability: false },
  { value: 'investment', label: 'Investments', icon: '📈', liability: false },
  { value: 'property', label: 'Property', icon: '🏠', liability: false },
  { value: 'credit', label: 'Credit card', icon: '💸', liability: true },
  { value: 'loan', label: 'Loan / mortgage', icon: '🏦', liability: true },
  { value: 'other', label: 'Other', icon: '📦', liability: false },
]

export const kindOf = (a: Pick<Account, 'kind'>): AccountKind => a.kind ?? 'bank'
export const kindInfo = (k: AccountKind) => ACCOUNT_KINDS.find((x) => x.value === k) ?? ACCOUNT_KINDS[0]

/** Accounts the forecast spends from: everyday + credit cards (not savings, super, assets). */
export function isSpendable(a: Pick<Account, 'kind'>): boolean {
  const k = kindOf(a)
  return k === 'bank' || k === 'credit'
}

/**
 * Debts are stored as negative balances, but people type them in as positive
 * numbers — so a liability's balance always counts as a negative.
 */
export function signedBalance(a: Pick<Account, 'kind' | 'balance'>): number {
  const b = a.balance ?? 0
  return kindInfo(kindOf(a)).liability ? -Math.abs(b) : b
}

export interface NetWorthGroup { kind: AccountKind; total: number; accounts: Account[] }

export function groupNetWorth(accounts: Account[]): { assets: number; liabilities: number; net: number; groups: NetWorthGroup[] } {
  const groups = new Map<AccountKind, Account[]>()
  for (const a of accounts) if (!a.is_archived) groups.set(kindOf(a), [...(groups.get(kindOf(a)) ?? []), a])
  let assets = 0
  let liabilities = 0
  const out: NetWorthGroup[] = []
  for (const k of ACCOUNT_KINDS) {
    const list = groups.get(k.value)
    if (!list) continue
    const total = list.reduce((s, a) => s + signedBalance(a), 0)
    if (total >= 0) assets += total
    else liabilities -= total
    out.push({ kind: k.value, total: Math.round(total * 100) / 100, accounts: list })
  }
  return { assets: Math.round(assets * 100) / 100, liabilities: Math.round(liabilities * 100) / 100, net: Math.round((assets - liabilities) * 100) / 100, groups: out }
}

/**
 * Net worth over time, one point per month-end: each account's latest known
 * balance at that date (carried forward), summed. Accounts with no history
 * before a month-end are left out of it rather than counted as zero.
 */
export function netWorthHistory(accounts: Account[], history: BalancePoint[], monthEnds: string[]): { date: string; net: number }[] {
  const byAccount = new Map<string, BalancePoint[]>()
  for (const p of history) byAccount.set(p.account_id, [...(byAccount.get(p.account_id) ?? []), p])
  for (const list of byAccount.values()) list.sort((a, b) => a.as_of.localeCompare(b.as_of))
  return monthEnds.map((date) => {
    let net = 0
    for (const a of accounts) {
      if (a.is_archived) continue
      const pts = byAccount.get(a.id)
      const latest = pts?.filter((p) => p.as_of <= date).pop()
      if (latest) net += signedBalance({ kind: a.kind, balance: latest.balance })
    }
    return { date, net: Math.round(net * 100) / 100 }
  })
}
