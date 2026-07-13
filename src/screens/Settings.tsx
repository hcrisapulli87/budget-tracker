import { useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { useData } from '../data/DataProvider'
import { addCategory, updateCategory } from '../data/categories'
import { deleteRule } from '../data/rules'

export default function Settings() {
  const { signOut, user } = useAuth()
  const { categories, rules, profiles, reload } = useData()
  const [newCat, setNewCat] = useState('')
  const me = profiles.find((p) => p.id === user?.id)

  const addCat = async () => {
    if (!newCat.trim()) return
    await addCategory({ name: newCat.trim(), colour: '#9aa5b1', icon: '🏷️', sortOrder: categories.length + 1 })
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
        <h2>Learned rules <span className="badge">{rules.length}</span></h2>
        <p className="txn__sub">Created automatically when you correct a category. Delete one if it keeps guessing wrong.</p>
        {rules
          .filter((r) => r.created_from === 'correction')
          .map((r) => (
            <div key={r.id} className="row--between" style={{ marginBottom: 4 }}>
              <span className="txn__sub">"{r.pattern}" → {catName(r.category_id)}</span>
              <button className="btn btn--small" onClick={() => void deleteRule(r.id).then(reload)}>✕</button>
            </div>
          ))}
      </div>

      <div className="card">
        <h2>Account</h2>
        <p className="muted">Signed in as {me?.display_name ?? user?.email}</p>
        <button className="btn" onClick={() => void signOut()}>Sign out</button>
      </div>
    </div>
  )
}
