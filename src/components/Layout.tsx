import { NavLink, Outlet } from 'react-router-dom'
import { PartnerBanner } from './PersonSwitcher'

// Five tabs, one job each. Trends, Tax, Import and Settings are reached from
// Home's quick links and the profile avatar.
const TABS = [
  { to: '/', label: 'Home', icon: '🏠' },
  { to: '/transactions', label: 'Activity', icon: '🧾' },
  { to: '/budgets', label: 'Budgets', icon: '🎯' },
  { to: '/recurring', label: 'Recurring', icon: '🔁' },
  { to: '/accounts', label: 'Accounts', icon: '🏦' },
]

export function Layout() {
  return (
    <>
      <PartnerBanner />
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
