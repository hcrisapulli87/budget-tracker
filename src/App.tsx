import { Routes, Route } from 'react-router-dom'
import { useAuth } from './auth/AuthProvider'
import { DataProvider } from './data/DataProvider'
import { Layout } from './components/Layout'
import Login from './screens/Login'
import Dashboard from './screens/Dashboard'
import Transactions from './screens/Transactions'
import ImportScreen from './screens/ImportScreen'
import Subscriptions from './screens/Subscriptions'
import Bills from './screens/Bills'
import Settings from './screens/Settings'

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
    <DataProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/transactions" element={<Transactions />} />
          <Route path="/import" element={<ImportScreen />} />
          <Route path="/subscriptions" element={<Subscriptions />} />
          <Route path="/bills" element={<Bills />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Routes>
    </DataProvider>
  )
}
