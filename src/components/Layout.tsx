import { NavLink, Outlet } from 'react-router-dom'

// The redesign's primary five. Insights, Budgets, Tax, Imports, Settings are
// reached from Home quick-links + the profile avatar, not the tab bar.
const TABS = [
  { to: '/', label: 'Home', icon: '🏠' },
  { to: '/transactions', label: 'Spend', icon: '🧾' },
  { to: '/accounts', label: 'Accounts', icon: '🏦' },
  { to: '/subs', label: 'Subs', icon: '🔁' },
  { to: '/bills', label: 'Bills', icon: '📅' },
]

export function Layout() {
  return (
    <>
      <Outlet />
      <nav className="tabbar">
        {TABS.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.to === '/'} className={({ isActive }) => (isActive ? 'active' : '')}>
            <span className="icon">{t.icon}</span>
            {t.label}
          </NavLink>
        ))}
      </nav>
    </>
  )
}
