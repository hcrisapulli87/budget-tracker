import { useAuth } from './auth/AuthProvider'
import Login from './screens/Login'

export default function App() {
  const { loading, session } = useAuth()
  if (loading) {
    return (
      <main className="screen screen--center">
        <p className="muted">Loading…</p>
      </main>
    )
  }
  if (!session) return <Login />
  return (
    <main className="screen screen--center">
      <p className="muted">Signed in — shell arrives in Task 4.</p>
    </main>
  )
}
