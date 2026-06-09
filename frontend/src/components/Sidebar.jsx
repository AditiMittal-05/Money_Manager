import { NavLink, useNavigate } from 'react-router-dom'
import { clearAuth } from '../api'

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
  const navigate = useNavigate()

  function handleLogout() {
    clearAuth()
    navigate('/')
  }

  const username = localStorage.getItem('username') || 'U'
  const initials = username
    .split(/[_\s.\-]+/)
    .filter(Boolean)
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || username[0]?.toUpperCase() || 'U'

  return (
    <>
      <nav className="sidebar">
        <div className="sidebar-logo">💰 MoneyMgr</div>

        <ul>
          {navItems.map(item => (
            <li key={item.path}>
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

      {/* Profile avatar — fixed top-right corner, present on every authenticated page */}
      <div
        style={{
          position: 'fixed',
          top: 18,
          right: 20,
          zIndex: 1000,
          width: 38,
          height: 38,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          border: '2px solid rgba(139,92,246,0.45)',
          boxShadow: '0 0 18px rgba(139,92,246,0.35), 0 2px 8px rgba(0,0,0,0.45)',
          color: '#FFFFFF',
          fontSize: 13,
          fontWeight: 800,
          letterSpacing: '-0.5px',
          transition: 'transform 0.18s ease, box-shadow 0.18s ease',
          userSelect: 'none',
          fontFamily: 'Inter, sans-serif',
        }}
        onClick={() => navigate('/profile')}
        title={`${username} — View Profile`}
        onMouseEnter={e => {
          e.currentTarget.style.transform = 'scale(1.12)'
          e.currentTarget.style.boxShadow = '0 0 28px rgba(139,92,246,0.65), 0 4px 14px rgba(0,0,0,0.50)'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.transform = 'scale(1)'
          e.currentTarget.style.boxShadow = '0 0 18px rgba(139,92,246,0.35), 0 2px 8px rgba(0,0,0,0.45)'
        }}
      >
        {initials}
      </div>
    </>
  )
}
