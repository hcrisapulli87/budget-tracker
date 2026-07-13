import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { useData } from '../data/DataProvider'
import { addCategory, updateCategory } from '../data/categories'
import { deleteRule } from '../data/rules'
import { clearBudget, setBudget } from '../data/budgets'
import { formatAUD } from '../domain/money'
import { IconCircle } from '../components/ui/IconCircle'

export default function Settings() {
  const { signOut, user } = useAuth()
  const { categories, rules, budgets, profiles, reload } = useData()
  const [newCat, setNewCat] = useState('')
  const [limits, setLimits] = useState<Record<string, string>>({})
  const me = profiles.find((p) => p.id === user?.id)

  const addCat = async () => {
    if (!newCat.trim()) return
    await addCategory({ name: newCat.trim(), colour: '#8ba59a', icon: '🏷️', sortOrder: categories.length + 1 })
    setNewCat('')
    await reload()
  }

  const catName = (id: string) => categories.find((c) => c.id === id)?.name ?? '?'
  const budgetFor = (categoryId: string) => budgets.find((b) => b.category_id === categoryId)

  const saveLimit = async (categoryId: string) => {
    const raw = (limits[categoryId] ?? '').trim()
    const value = Number(raw)
    if (raw === '' || !Number.isFinite(value) || value <= 0) {
      await clearBudget(categoryId)
    } else {
      await setBudget(categoryId, value)
    }
    setLimits((l) => ({ ...l, [categoryId]: '' }))
    await reload()
  }

  return (
    <div className="screen">
      <h1 className="brand">Settings</h1>

      <div className="card">
        <h2>Budgets</h2>
        <p className="txn__sub" style={{ whiteSpace: 'normal' }}>Set a monthly limit for the categories you care about. Clear the box and save to remove one.</p>
        {categories.filter((c) => !c.is_archived && !c.exclude_from_analytics).map((c) => {
          const b = budgetFor(c.id)
          return (
            <div key={c.id} className="row" style={{ marginBottom: 6 }}>
              <IconCircle icon={c.icon} colour={c.colour} size={28} />
              <span className="cat-label">{c.name}</span>
              <input
                className="input" type="number" inputMode="decimal" style={{ flex: 1 }}
                placeholder={b ? formatAUD(b.monthly_limit) : 'no limit'}
                value={limits[c.id] ?? ''}
                onChange={(e) => setLimits((l) => ({ ...l, [c.id]: e.target.value }))}
              />
              <button className="btn btn--small" onClick={() => void saveLimit(c.id)}>Save</button>
            </div>
          )
        })}
      </div>

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
        <h2>Learned rules <span className="badge">{rules.length}</span></h2>
        <p className="txn__sub" style={{ whiteSpace: 'normal' }}>Created automatically when you correct a category. Delete one if it keeps guessing wrong.</p>
        {rules.filter((r) => r.created_from === 'correction').map((r) => (
          <div key={r.id} className="row--between" style={{ marginBottom: 4 }}>
            <span className="txn__sub">"{r.pattern}" → {catName(r.category_id)}</span>
            <button className="btn btn--small" onClick={() => void deleteRule(r.id).then(reload)}>✕</button>
          </div>
        ))}
      </div>

      <div className="card">
        <h2>Data</h2>
        <Link to="/import" className="btn" style={{ display: 'block', textAlign: 'center', textDecoration: 'none', marginBottom: 8 }}>Import bank CSV</Link>
      </div>

      <div className="card">
        <h2>Account</h2>
        <p className="muted">Signed in as {me?.display_name ?? user?.email}</p>
        <button className="btn" onClick={() => void signOut()}>Sign out</button>
      </div>
    </div>
  )
}
