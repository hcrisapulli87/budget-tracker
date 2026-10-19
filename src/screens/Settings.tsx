import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { useData } from '../data/DataProvider'
import { addCategory, updateCategory } from '../data/categories'
import { deleteRule } from '../data/rules'
import { DEFAULT_PREFS, currentPush, disablePush, enablePush, pushSupport, updatePushPrefs } from '../data/push'
import type { PushPrefs } from '../data/push'
import { Toggle } from '../components/ui/Toggle'

export default function Settings() {
  const { signOut, user } = useAuth()
  const { categories, rules, me, reload } = useData()
  const [newCat, setNewCat] = useState('')

  const addCat = async () => {
    if (!newCat.trim()) return
    await addCategory({ name: newCat.trim(), colour: '#8ba59a', icon: '🏷️', sortOrder: categories.length + 1 })
    setNewCat('')
    await reload()
  }

  const catName = (id: string) => categories.find((c) => c.id === id)?.name ?? '?'
  return (
    <div className="screen">
      <h1 className="brand">Settings</h1>

      <div className="card">
        <h2>Categories</h2>
        {categories.map((c) => (
          <div key={c.id} className="row--between" style={{ marginBottom: 4 }}>
            <span>{c.icon} {c.name}</span>
            <button className="btn btn--small" onClick={() => void updateCategory(c.id, { is_archived: true }).then(reload)}>Archive</button>
          </div>
        ))}
        <div className="row">
          <input className="input" placeholder="New category" value={newCat} onChange={(e) => setNewCat(e.target.value)} />
          <button className="btn" onClick={() => void addCat()}>Add</button>
        </div>
      </div>

      <div className="card">
        <h2>Your learned rules <span className="badge">{rules.filter((r) => r.owner_id === user?.id).length}</span></h2>
        <p className="txn__sub" style={{ whiteSpace: 'normal' }}>Created automatically when you correct a category, and only applied to your transactions. Delete one if it keeps guessing wrong.</p>
        {rules.filter((r) => r.owner_id === user?.id).map((r) => (
          <div key={r.id} className="row--between" style={{ marginBottom: 4 }}>
            <span className="txn__sub">"{r.pattern}" → {catName(r.category_id)}</span>
            <button className="btn btn--small" onClick={() => void deleteRule(r.id).then(reload)}>✕</button>
          </div>
        ))}
      </div>

      {user && <NotificationsCard ownerId={user.id} />}

      <div className="card">
        <h2>Data</h2>
        <Link to="/budgets" className="btn" style={{ display: 'block', textAlign: 'center', textDecoration: 'none', marginBottom: 8 }}>Budgets</Link>
        <Link to="/import" className="btn" style={{ display: 'block', textAlign: 'center', textDecoration: 'none', marginBottom: 8 }}>Import bank CSV</Link>
        <Link to="/forecast" className="btn" style={{ display: 'block', textAlign: 'center', textDecoration: 'none', marginBottom: 8 }}>Forecast & pay cycle</Link>
        <Link to="/tax" className="btn" style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }}>Tax records</Link>
      </div>

      <div className="card">
        <h2>Account</h2>
        <p className="muted">Signed in as {me?.display_name ?? user?.email}</p>
        <button className="btn" onClick={() => void signOut()}>Sign out</button>
      </div>
    </div>
  )
}

const PREF_LABELS: { key: keyof PushPrefs; label: string }[] = [
  { key: 'bills', label: 'Bills due in the next 3 days' },
  { key: 'budgets', label: 'A budget passes 90% or goes over' },
  { key: 'subs', label: 'New subscriptions and price rises' },
]

/** Web Push on this device — one subscription per phone/browser. */
function NotificationsCard({ ownerId }: { ownerId: string }) {
  const support = pushSupport()
  const [endpoint, setEndpoint] = useState<string | null>(null)
  const [prefs, setPrefs] = useState<PushPrefs>(DEFAULT_PREFS)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')

  useEffect(() => {
    currentPush().then((p) => { setEndpoint(p?.endpoint ?? null); if (p) setPrefs(p.prefs) }).catch(() => setEndpoint(null))
  }, [])

  const toggle = async (on: boolean) => {
    setBusy(true)
    setNote('')
    try {
      if (on) {
        const ok = await enablePush(ownerId, prefs)
        if (!ok) setNote('Notifications are blocked — allow them for Tally in your phone or browser settings.')
        const p = await currentPush()
        setEndpoint(p?.endpoint ?? null)
      } else {
        await disablePush()
        setEndpoint(null)
      }
    } catch {
      setNote('Could not change notifications on this device.')
    } finally {
      setBusy(false)
    }
  }

  const setPref = async (key: keyof PushPrefs, on: boolean) => {
    const next = { ...prefs, [key]: on }
    setPrefs(next)
    if (endpoint) await updatePushPrefs(endpoint, next).catch(() => setNote('Could not save that.'))
  }

  return (
    <div className="card">
      <h2>Notifications</h2>
      {support === 'ok' ? (
        <>
          <label className="row--between" style={{ marginBottom: 8 }}>
            <span>Push notifications on this device</span>
            <Toggle on={endpoint !== null} label="Push notifications" onChange={(on) => { if (!busy) void toggle(on) }} />
          </label>
          {endpoint && PREF_LABELS.map((p) => (
            <label key={p.key} className="row--between" style={{ marginBottom: 6, fontSize: '0.88rem' }}>
              <span className="muted">{p.label}</span>
              <Toggle on={prefs[p.key]} label={p.label} onChange={(on) => void setPref(p.key, on)} />
            </label>
          ))}
        </>
      ) : (
        <p className="txn__sub" style={{ whiteSpace: 'normal' }}>
          {support === 'install-first'
            ? 'On iPhone, add Tally to your Home Screen first (Share → Add to Home Screen), then turn notifications on from there.'
            : support === 'not-configured'
              ? 'Push isn’t set up for this deployment yet (VITE_VAPID_PUBLIC_KEY is missing). Discord reminders still work.'
              : 'This browser doesn’t support push notifications.'}
        </p>
      )}
      {note && <p className="txn__sub warn" style={{ whiteSpace: 'normal' }}>{note}</p>}
      <p className="txn__sub" style={{ whiteSpace: 'normal' }}>Bill reminders still post to the household Discord too.</p>
    </div>
  )
}
