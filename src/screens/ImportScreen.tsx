import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { useData } from '../data/DataProvider'
import { BANK_PROFILES, applyProfile, genericProfile, latestBalance } from '../domain/bankProfiles'
import type { ColumnMapping } from '../domain/bankProfiles'
import { parseCsv } from '../domain/csv'
import { assignKeys } from '../domain/importKey'
import type { KeyedTxn } from '../domain/importKey'
import { normaliseMerchant } from '../domain/merchant'
import { matchRule } from '../domain/ruleEngine'
import { formatAUD } from '../domain/money'
import { createImport, fetchImports } from '../data/imports'
import { existingKeys, insertTransactions } from '../data/transactions'
import { syncSubscriptions } from '../data/subscriptions'
import { createAccount, fetchAccounts, recordBalance } from '../data/accounts'
import type { Account, ImportRecord } from '../data/types'

interface PreviewRow extends KeyedTxn {
  duplicate: boolean
  categoryId: string | null
}

const DEFAULT_MAPPING: ColumnMapping = { hasHeader: true, dateCol: 0, descCol: 1, amountCol: 2, dateStyle: 'dmy' }

export default function ImportScreen() {
  const { user } = useAuth()
  const { categories, rules, ready } = useData()
  const [account, setAccount] = useState(() => localStorage.getItem('tally.account') ?? '')
  const [profileId, setProfileId] = useState(() => localStorage.getItem('tally.profile') ?? 'commbank')
  const [mapping, setMapping] = useState<ColumnMapping>(DEFAULT_MAPPING)
  const [filename, setFilename] = useState('')
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

  const profile = useMemo(
    () => (profileId === 'generic' ? genericProfile(mapping) : BANK_PROFILES.find((p) => p.id === profileId) ?? BANK_PROFILES[0]),
    [profileId, mapping],
  )

  const catName = (id: string | null) => categories.find((c) => c.id === id)?.name ?? 'Uncategorised'

  const onFile = async (file: File) => {
    setError('')
    setResult('')
    if (!account.trim()) {
      setError('Give the account a name first (e.g. "Everyday") — it keys deduplication.')
      return
    }
    try {
      const rows = parseCsv(await file.text())
      const parsed = applyProfile(rows, profile)
      if (parsed.length === 0) {
        setError('No rows parsed — wrong bank profile for this file?')
        return
      }
      const keyed = assignKeys(parsed, account.trim())
      const existing = await existingKeys(keyed.map((k) => k.key))
      setFilename(file.name)
      setPreview(
        keyed.map((k) => ({
          ...k,
          duplicate: existing.has(k.key),
          categoryId: matchRule(normaliseMerchant(k.txn.description), rules)?.category_id ?? null,
        })),
      )
      localStorage.setItem('tally.account', account.trim())
      localStorage.setItem('tally.profile', profileId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read that file.')
    }
  }

  const confirm = async () => {
    if (!preview || !user) return
    setBusy(true)
    setError('')
    try {
      const fresh = preview.filter((r) => !r.duplicate)
      const record = await createImport({
        ownerId: user.id,
        account: account.trim(),
        filename,
        rowCount: preview.length,
        newCount: fresh.length,
        duplicateCount: preview.length - fresh.length,
      })
      await insertTransactions(
        fresh.map((r) => ({
          owner_id: user.id,
          account: account.trim(),
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
      let balanceNote = ''
      try {
        const bal = latestBalance(preview.map((r) => r.txn))
        if (bal) {
          await recordBalance(account.trim(), user.id, bal.balance, bal.dateIso)
          balanceNote = ` Balance: ${formatAUD(bal.balance)} as at ${bal.dateIso}.`
        } else if (!accounts.some((a) => a.name === account.trim())) {
          await createAccount(account.trim(), user.id) // no balance column — still list the account
        }
      } catch {
        // never fail an import over balance bookkeeping
      }
      const found = await syncSubscriptions(user.id)
      setResult(
        `${fresh.length} new, ${preview.length - fresh.length} duplicates skipped.` +
          balanceNote +
          (found ? ` ${found} possible subscription${found > 1 ? 's' : ''} spotted — check the Subs tab.` : ''),
      )
      setPreview(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="screen">
      <h1 className="brand">Import</h1>
      <div className="card">
        <label className="muted">Account</label>
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

      {preview && (
        <div className="card">
          <div className="row--between">
            <h2>{filename} — {preview.length} rows</h2>
            <button className="btn btn--primary" disabled={busy || preview.every((r) => r.duplicate)} onClick={() => void confirm()}>
              {busy ? 'Importing…' : `Import ${preview.filter((r) => !r.duplicate).length} new`}
            </button>
          </div>
          <table className="preview">
            <thead>
              <tr><th>Date</th><th>Description</th><th>Amount</th><th>Category (guess)</th><th></th></tr>
            </thead>
            <tbody>
              {preview.map((r) => (
                <tr key={r.key}>
                  <td>{r.txn.dateIso}</td>
                  <td>{r.txn.description}</td>
                  <td className="amount">{formatAUD(r.txn.amount)}</td>
                  <td>{catName(r.categoryId)}</td>
                  <td>{r.duplicate ? <span className="badge badge--dup">dup</span> : <span className="badge badge--new">new</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
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
                  <div className="txn__sub">{h.imported_at.slice(0, 10)} — {h.new_count} new, {h.duplicate_count} dup</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
