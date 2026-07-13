import { NavLink, Outlet } from 'react-router-dom'

const TABS = [
  { to: '/', label: 'Home', icon: '📊' },
  { to: '/transactions', label: 'Activity', icon: '🧾' },
  { to: '/import', label: 'Import', icon: '📥' },
  { to: '/subscriptions', label: 'Subs', icon: '🔁' },
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
