import { NavLink, Outlet } from 'react-router-dom'

const LEFT = [
  { to: '/', label: 'Home', icon: '📊' },
  { to: '/transactions', label: 'Activity', icon: '🧾' },
]
const RIGHT = [
  { to: '/insights', label: 'Insights', icon: '📈' },
  { to: '/recurring', label: 'Recurring', icon: '🔁' },
]

export function Layout() {
  return (
    <>
      <Outlet />
      <nav className="tabbar">
        {LEFT.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.to === '/'} className={({ isActive }) => (isActive ? 'active' : '')}>
            <span className="icon">{t.icon}</span>
            {t.label}
          </NavLink>
        ))}
        <NavLink to="/add" className="tab-add" aria-label="Add transaction">
          <span>＋</span>
        </NavLink>
        {RIGHT.map((t) => (
          <NavLink key={t.to} to={t.to} className={({ isActive }) => (isActive ? 'active' : '')}>
            <span className="icon">{t.icon}</span>
            {t.label}
          </NavLink>
        ))}
      </nav>
    </>
  )
}
