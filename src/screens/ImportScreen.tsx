import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { useData } from '../data/DataProvider'
import { BANK_PROFILES, applyProfile, genericProfile, latestBalance } from '../domain/bankProfiles'
import type { ColumnMapping, ParsedTxn } from '../domain/bankProfiles'
import { parseCsv } from '../domain/csv'
import { assignKeys } from '../domain/importKey'
import type { KeyedTxn } from '../domain/importKey'
import { digitsOf, formatBsb, groupByAccountRef, matchAccountByRef, splitRef } from '../domain/accountMatch'
import { normaliseMerchant } from '../domain/merchant'
import { matchRule } from '../domain/ruleEngine'
import { formatAUD, formatDayMonth } from '../domain/money'
import { createImport, fetchImports } from '../data/imports'
import { existingKeys, insertTransactions } from '../data/transactions'
import { syncSubscriptions } from '../data/subscriptions'
import { createAccount, fetchAccounts, recordBalance, updateAccount } from '../data/accounts'
import type { Account, ImportRecord } from '../data/types'

interface PreviewRow extends KeyedTxn {
  duplicate: boolean
  categoryId: string | null
  /** Which account this row lands in (multi-account files route per row). */
  account: string
}

/** An account identifier found in the file that matches no configured account. */
interface UnknownGroup {
  ref: string
  count: number
  choice: string // existing account name, or '__create'
  newName: string
}

const DEFAULT_MAPPING: ColumnMapping = { hasHeader: true, dateCol: 0, descCol: 1, amountCol: 2, dateStyle: 'dmy' }

export default function ImportScreen() {
  const { user } = useAuth()
  const { categories, rules, ready } = useData()
  const [account, setAccount] = useState(() => localStorage.getItem('tally.account') ?? '')
  const [profileId, setProfileId] = useState(() => localStorage.getItem('tally.profile') ?? 'commbank')
  const [mapping, setMapping] = useState<ColumnMapping>(DEFAULT_MAPPING)
  const [filename, setFilename] = useState('')
  const [parsedRows, setParsedRows] = useState<ParsedTxn[] | null>(null)
  const [unknownGroups, setUnknownGroups] = useState<UnknownGroup[]>([])
  const [preview, setPreview] = useState<PreviewRow[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState('')
  const [error, setError] = useState('')
  const [history, setHistory] = useState<ImportRecord[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])

  useEffect(() => {
    fetchImports().then(setHistory).catch(() => setHistory([]))
    fetchAccounts().then(setAccounts).catch(() => setAccounts([]))
  }, [result])

  const knownAccount = accounts.some((a) => !a.is_archived && a.name === account.trim())

  // Nothing remembered yet → preselect the first real account instead of "New".
  useEffect(() => {
    if (!account && accounts.length > 0) {
      const first = accounts.find((a) => !a.is_archived)
      if (first) setAccount(first.name)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts])

  const profile = useMemo(
    () => (profileId === 'generic' ? genericProfile(mapping) : BANK_PROFILES.find((p) => p.id === profileId) ?? BANK_PROFILES[0]),
    [profileId, mapping],
  )

  const catName = (id: string | null) => categories.find((c) => c.id === id)?.name ?? 'Uncategorised'

  /** ref → account name, from auto-matches plus the user's mapping choices. */
  const resolveRef = (ref: string, groups: UnknownGroup[]): string | null => {
    if (ref === '') return account.trim() || null
    const matched = matchAccountByRef(ref, accounts)
    if (matched) return matched.name
    const g = groups.find((u) => u.ref === ref)
    if (!g) return null
    if (g.choice === '__create') return g.newName.trim() || null
    return g.choice || null
  }

  const buildPreview = async (parsed: ParsedTxn[], groups: UnknownGroup[]) => {
    const byRef = groupByAccountRef(parsed)
    const keyed: PreviewRow[] = []
    for (const [ref, rows] of byRef) {
      const name = resolveRef(ref, groups)
      if (!name) {
        setError(ref === '' ? 'Give the account a name first (e.g. "Everyday") — it keys deduplication.' : 'Map every account in the file first.')
        return
      }
      for (const k of assignKeys(rows, name)) {
        keyed.push({
          ...k,
          account: name,
          duplicate: false,
          categoryId: matchRule(normaliseMerchant(k.txn.description), rules)?.category_id ?? null,
        })
      }
    }
    const existing = await existingKeys(keyed.map((k) => k.key))
    setPreview(keyed.map((k) => ({ ...k, duplicate: existing.has(k.key) })))
  }

  const onFile = async (file: File) => {
    setError('')
    setResult('')
    setPreview(null)
    setUnknownGroups([])
    try {
      const rows = parseCsv(await file.text())
      const parsed = applyProfile(rows, profile)
      if (parsed.length === 0) {
        setError('No rows parsed — wrong bank profile for this file?')
        return
      }
      const byRef = groupByAccountRef(parsed)
      if (byRef.has('') && !account.trim()) {
        setError('Give the account a name first (e.g. "Everyday") — it keys deduplication.')
        return
      }
      setFilename(file.name)
      setParsedRows(parsed)
      const unknown = [...byRef.entries()]
        .filter(([ref]) => ref !== '' && !matchAccountByRef(ref, accounts))
        .map(([ref, group]) => {
          const { bsb, accountNumber } = splitRef(ref)
          return {
            ref,
            count: group.length,
            choice: '__create',
            newName: `Account …${accountNumber.slice(-4)}${bsb ? ` (${formatBsb(bsb)})` : ''}`,
          }
        })
      setUnknownGroups(unknown)
      if (unknown.length === 0) await buildPreview(parsed, [])
      localStorage.setItem('tally.account', account.trim())
      localStorage.setItem('tally.profile', profileId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read that file.')
    }
  }

  const mappingComplete = unknownGroups.every((g) => (g.choice === '__create' ? g.newName.trim() !== '' : g.choice !== ''))

  const applyMapping = async () => {
    if (!parsedRows || !mappingComplete) return
    setError('')
    await buildPreview(parsedRows, unknownGroups)
  }

  const confirm = async () => {
    if (!preview || !parsedRows || !user) return
    setBusy(true)
    setError('')
    try {
      // Unknown identifiers the user chose to create/backfill — do the account
      // bookkeeping first so future combined files route themselves.
      for (const g of unknownGroups) {
        const { bsb, accountNumber } = splitRef(g.ref)
        if (g.choice === '__create') {
          if (!accounts.some((a) => a.name === g.newName.trim())) {
            await createAccount(g.newName.trim(), user.id, null, null, null, bsb, accountNumber)
          }
        } else {
          const target = accounts.find((a) => a.name === g.choice)
          if (target && digitsOf(target.account_number) === '') {
            await updateAccount(target.id, { bsb, account_number: accountNumber })
          }
        }
      }

      // One import record + one balance capture per account the file touched.
      const byAccount = new Map<string, PreviewRow[]>()
      for (const r of preview) {
        const bucket = byAccount.get(r.account)
        if (bucket) bucket.push(r)
        else byAccount.set(r.account, [r])
      }
      let totalNew = 0
      const balanceNotes: string[] = []
      for (const [accName, rows] of byAccount) {
        const fresh = rows.filter((r) => !r.duplicate)
        totalNew += fresh.length
        const record = await createImport({
          ownerId: user.id,
          account: accName,
          filename,
          rowCount: rows.length,
          newCount: fresh.length,
          duplicateCount: rows.length - fresh.length,
        })
        await insertTransactions(
          fresh.map((r) => ({
            owner_id: user.id,
            account: accName,
            txn_date: r.txn.dateIso,
            amount: r.txn.amount,
            description: r.txn.description,
            merchant_norm: normaliseMerchant(r.txn.description),
            category_id: r.categoryId,
            category_confirmed: false,
            import_hash: r.key,
            source: 'csv' as const,
            import_id: record.id,
          })),
        )
        // Balance capture rides the import — the statement's running-balance column
        // is the freshest figure we'll ever get for this account, no typing needed.
        try {
          const bal = latestBalance(rows.map((r) => r.txn))
          if (bal) {
            await recordBalance(accName, user.id, bal.balance, bal.dateIso)
            balanceNotes.push(`${accName}: ${formatAUD(bal.balance)} as at ${bal.dateIso}`)
          } else if (!accounts.some((a) => a.name === accName)) {
            await createAccount(accName, user.id) // no balance column — still list the account
          }
        } catch {
          // never fail an import over balance bookkeeping
        }
      }
      const found = await syncSubscriptions(user.id)
      setResult(
        `${totalNew} new, ${preview.length - totalNew} duplicates skipped` +
          (byAccount.size > 1 ? ` across ${byAccount.size} accounts.` : '.') +
          (balanceNotes.length > 0 ? ` Balance${balanceNotes.length > 1 ? 's' : ''}: ${balanceNotes.join(' · ')}.` : '') +
          (found ? ` ${found} possible subscription${found > 1 ? 's' : ''} spotted — check the Subs tab.` : ''),
      )
      setPreview(null)
      setParsedRows(null)
      setUnknownGroups([])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed.')
    } finally {
      setBusy(false)
    }
  }

  const previewAccounts = preview ? new Set(preview.map((r) => r.account)) : null
  const multiAccount = (previewAccounts?.size ?? 0) > 1

  return (
    <div className="screen">
      <h1 className="brand">Import</h1>
      <div className="card">
        <label className="muted">Account (for files without per-row account numbers)</label>
        <select className="input" value={knownAccount ? account.trim() : '__new'} onChange={(e) => setAccount(e.target.value === '__new' ? '' : e.target.value)}>
          {accounts.filter((a) => !a.is_archived).map((a) => (
            <option key={a.id} value={a.name}>{a.name}</option>
          ))}
          <option value="__new">＋ New account…</option>
        </select>
        {!knownAccount && (
          <input className="input" value={account} placeholder='Account name, e.g. "NAB Savings"' onChange={(e) => setAccount(e.target.value)} />
        )}
        <label className="muted">Bank format</label>
        <select className="input" value={profileId} onChange={(e) => setProfileId(e.target.value)}>
          {BANK_PROFILES.map((p) => (
            <option key={p.id} value={p.id}>{p.label}</option>
          ))}
          <option value="generic">Custom — map columns myself</option>
        </select>
        {profileId === 'generic' && (
          <div className="card">
            <label className="row">
              <input type="checkbox" checked={mapping.hasHeader} onChange={(e) => setMapping({ ...mapping, hasHeader: e.target.checked })} />
              First row is a header
            </label>
            <label className="muted">Date column # (first column = 0)</label>
            <input className="input" type="number" value={mapping.dateCol} onChange={(e) => setMapping({ ...mapping, dateCol: Number(e.target.value) })} />
            <label className="muted">Description column #</label>
            <input className="input" type="number" value={mapping.descCol} onChange={(e) => setMapping({ ...mapping, descCol: Number(e.target.value) })} />
            <label className="muted">Amount column # (single signed column)</label>
            <input className="input" type="number" value={mapping.amountCol ?? 2} onChange={(e) => setMapping({ ...mapping, amountCol: Number(e.target.value), debitCol: undefined, creditCol: undefined })} />
            <label className="muted">BSB column # (optional — combined multi-account files)</label>
            <input className="input" type="number" value={mapping.bsbCol ?? ''} placeholder="—" onChange={(e) => setMapping({ ...mapping, bsbCol: e.target.value === '' ? undefined : Number(e.target.value) })} />
            <label className="muted">Account number column # (optional)</label>
            <input className="input" type="number" value={mapping.accountCol ?? ''} placeholder="—" onChange={(e) => setMapping({ ...mapping, accountCol: e.target.value === '' ? undefined : Number(e.target.value) })} />
            <label className="muted">Date style</label>
            <select className="input" value={mapping.dateStyle} onChange={(e) => setMapping({ ...mapping, dateStyle: e.target.value as 'dmy' | 'iso' })}>
              <option value="dmy">dd/mm/yyyy</option>
              <option value="iso">yyyy-mm-dd</option>
            </select>
          </div>
        )}
        <input
          className="input"
          type="file"
          accept=".csv,text/csv"
          disabled={!ready}
          onChange={(e) => e.target.files?.[0] && void onFile(e.target.files[0])}
        />
        {error && <p className="error">{error}</p>}
        {result && <p className="muted">✅ {result}</p>}
      </div>

      {unknownGroups.length > 0 && !preview && (
        <div className="card">
          <h2>New account numbers in this file</h2>
          <p className="txn__sub" style={{ whiteSpace: 'normal' }}>
            These rows carry BSB/account numbers that don't match any account yet. Pick where each goes — Tally remembers for next time.
          </p>
          {unknownGroups.map((g) => {
            const { bsb, accountNumber } = splitRef(g.ref)
            return (
              <div key={g.ref} style={{ marginBottom: 12 }}>
                <label className="muted">
                  {bsb ? `BSB ${formatBsb(bsb)} · ` : ''}Acct {accountNumber} — {g.count} row{g.count === 1 ? '' : 's'}
                </label>
                <select
                  className="input"
                  value={g.choice}
                  onChange={(e) => setUnknownGroups(unknownGroups.map((u) => (u.ref === g.ref ? { ...u, choice: e.target.value } : u)))}
                >
                  <option value="__create">＋ Create new account…</option>
                  {accounts.filter((a) => !a.is_archived).map((a) => (
                    <option key={a.id} value={a.name}>{a.name}</option>
                  ))}
                </select>
                {g.choice === '__create' && (
                  <input
                    className="input"
                    value={g.newName}
                    placeholder="New account name"
                    onChange={(e) => setUnknownGroups(unknownGroups.map((u) => (u.ref === g.ref ? { ...u, newName: e.target.value } : u)))}
                  />
                )}
              </div>
            )
          })}
          <button className="btn btn--primary" disabled={!mappingComplete} onClick={() => void applyMapping()}>
            Continue
          </button>
        </div>
      )}

      {preview && (
        <div className="card">
          <div className="row--between">
            <h2>{filename} — {preview.length} rows{multiAccount ? ` · ${previewAccounts!.size} accounts` : ''}</h2>
            <button className="btn btn--primary" disabled={busy || preview.every((r) => r.duplicate)} onClick={() => void confirm()}>
              {busy ? 'Importing…' : `Import ${preview.filter((r) => !r.duplicate).length} new`}
            </button>
          </div>
          <div className="table-scroll">
            <table className="preview">
              <thead>
                <tr><th>Date</th>{multiAccount && <th>Account</th>}<th>Description</th><th>Amount</th><th>Category (guess)</th><th></th></tr>
              </thead>
              <tbody>
                {preview.map((r) => (
                  <tr key={r.key}>
                    <td>{formatDayMonth(r.txn.dateIso)}</td>
                    {multiAccount && <td>{r.account}</td>}
                    <td>{r.txn.description}</td>
                    <td className="amount">{formatAUD(r.txn.amount)}</td>
                    <td>{catName(r.categoryId)}</td>
                    <td>{r.duplicate ? <span className="badge badge--dup">dup</span> : <span className="badge badge--new">new</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {history.length > 0 && (
        <div className="card">
          <h2>Recent imports</h2>
          <ul className="list-plain">
            {history.map((h) => (
              <li key={h.id} className="txn">
                <div className="txn__main">
                  <div className="txn__desc">{h.filename} → {h.account}</div>
                  <div className="txn__sub">{formatDayMonth(h.imported_at.slice(0, 10))} — {h.new_count} new, {h.duplicate_count} dup</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
