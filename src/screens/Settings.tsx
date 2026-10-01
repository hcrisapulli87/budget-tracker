import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { useData } from '../data/DataProvider'
import { addCategory, updateCategory } from '../data/categories'
import { deleteRule } from '../data/rules'

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

      <div className="card">
        <h2>Data</h2>
        <Link to="/budgets" className="btn" style={{ display: 'block', textAlign: 'center', textDecoration: 'none', marginBottom: 8 }}>Budgets</Link>
        <Link to="/import" className="btn" style={{ display: 'block', textAlign: 'center', textDecoration: 'none', marginBottom: 8 }}>Import bank CSV</Link>
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
