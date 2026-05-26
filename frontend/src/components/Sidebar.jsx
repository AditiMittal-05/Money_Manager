import { NavLink, useNavigate } from 'react-router-dom'
import { clearAuth } from '../api'

// Sidebar is a REUSABLE component — written once, used on every page.
// In the old HTML version, the sidebar was copy-pasted into every file.
// In React, we write it once here and import it where needed.

const navItems = [
  { path: '/dashboard',    icon: '🏠', label: 'Dashboard' },
  { path: '/transactions', icon: '💳', label: 'Transactions' },
  { path: '/accounts',     icon: '🏦', label: 'Accounts' },
  { path: '/categories',   icon: '🏷️', label: 'Categories' },
  { path: '/budgets',      icon: '📊', label: 'Budgets' },
  { path: '/analytics',    icon: '📈', label: 'Analytics' },
  { path: '/recurring',    icon: '🔁', label: 'Recurring' },
  { path: '/reports',      icon: '📋', label: 'Reports' },
  { path: '/settings',     icon: '⚙️', label: 'Settings' },
]

export default function Sidebar() {
  const navigate = useNavigate()   // useNavigate lets us programmatically change page

  function handleLogout() {
    clearAuth()           // remove token from localStorage
    navigate('/')         // go to login page
  }

  return (
    <nav className="sidebar">
      <div className="sidebar-logo">💰 MoneyMgr</div>

      <ul>
        {navItems.map(item => (
          <li key={item.path}>
            {/*
              NavLink is like <a> but React Router aware.
              className prop receives { isActive } — we use it to add 'active' class
              when this link matches the current URL.
            */}
            <NavLink
              to={item.path}
              className={({ isActive }) => isActive ? 'active' : ''}
            >
              {item.icon} {item.label}
            </NavLink>
          </li>
        ))}
      </ul>

      <button className="btn-logout" onClick={handleLogout}>
        🚪 Logout
      </button>
    </nav>
  )
}
