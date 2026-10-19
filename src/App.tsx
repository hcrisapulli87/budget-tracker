import { Suspense, lazy } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './auth/AuthProvider'
import { DataProvider } from './data/DataProvider'
import { Layout } from './components/Layout'
import Login from './screens/Login'
import Dashboard from './screens/Dashboard'
import Transactions from './screens/Transactions'
import AddScreen from './screens/AddScreen'
import Budgets from './screens/Budgets'
import Recurring from './screens/Recurring'
import AccountsScreen from './screens/AccountsScreen'

// Visited less often — loaded on demand to keep the first paint light.
const ImportScreen = lazy(() => import('./screens/ImportScreen'))
const Trends = lazy(() => import('./screens/Trends'))
const Settings = lazy(() => import('./screens/Settings'))
const TaxScreen = lazy(() => import('./screens/TaxScreen'))
const Forecast = lazy(() => import('./screens/Forecast'))
const Recap = lazy(() => import('./screens/Recap'))
const Ask = lazy(() => import('./screens/Ask'))

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
      <Suspense fallback={<main className="screen"><p className="muted">Loading…</p></main>}>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/transactions" element={<Transactions />} />
            <Route path="/add" element={<AddScreen />} />
            <Route path="/trends" element={<Trends />} />
            <Route path="/budgets" element={<Budgets />} />
            <Route path="/recurring" element={<Recurring />} />
            <Route path="/accounts" element={<AccountsScreen />} />
            <Route path="/import" element={<ImportScreen />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/tax" element={<TaxScreen />} />
            <Route path="/forecast" element={<Forecast />} />
            <Route path="/recap" element={<Recap />} />
            <Route path="/ask" element={<Ask />} />
            {/* pre-rework paths (home-screen bookmarks, Discord links) */}
            <Route path="/bills" element={<Navigate to="/recurring" replace />} />
            <Route path="/subs" element={<Navigate to="/recurring" replace />} />
            <Route path="/insights" element={<Navigate to="/trends" replace />} />
          </Route>
        </Routes>
      </Suspense>
    </DataProvider>
  )
}
