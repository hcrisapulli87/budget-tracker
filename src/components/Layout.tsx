import { NavLink, Outlet } from 'react-router-dom'

const TABS = [
  { to: '/', label: 'Home', icon: '📊' },
  { to: '/transactions', label: 'Activity', icon: '🧾' },
  { to: '/insights', label: 'Insights', icon: '📈' },
  { to: '/recurring', label: 'Recurring', icon: '🔁' },
  { to: '/tax', label: 'Tax', icon: '🧮' },
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
