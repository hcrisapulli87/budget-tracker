import { Link } from 'react-router-dom'

export default function Dashboard() {
  return (
    <div className="screen">
      <div className="row--between">
        <h1 className="brand">Tally</h1>
        <Link to="/settings" aria-label="Settings">⚙️</Link>
      </div>
      <p className="muted">Dashboard arrives in Task 14.</p>
    </div>
  )
}
