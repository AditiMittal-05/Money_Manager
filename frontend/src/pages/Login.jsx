import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { loginUser, registerUser, saveAuth } from '../api'

// ══════════════════════════════════════════════════════
// Login.jsx — the login & register page
//
// React concepts used here:
//   useState  → stores the form values and which tab is active
//   functions → handleLogin / handleRegister called on form submit
// ══════════════════════════════════════════════════════

export default function Login() {
  const navigate = useNavigate()

  // useState stores data that can change.
  // [value, setValue] — value is the current data, setValue updates it.
  const [tab, setTab] = useState('login')        // which tab: 'login' or 'register'
  const [message, setMessage] = useState(null)   // error/success message
  const [loading, setLoading] = useState(false)  // show "loading..." while waiting

  // Login form fields
  const [loginUser2, setLoginUser] = useState('')
  const [loginPass, setLoginPass] = useState('')

  // Register form fields
  const [regUsername, setRegUsername] = useState('')
  const [regEmail, setRegEmail] = useState('')
  const [regPass, setRegPass] = useState('')

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setMessage(null)
    try {
      const { ok, data } = await loginUser(loginUser2, loginPass)
      if (ok) {
        saveAuth(data.access_token, data.username)
        navigate('/dashboard')
      } else {
        setMessage({ text: data.detail || 'Login failed', type: 'error' })
      }
    } catch {
      setMessage({ text: 'Cannot connect to server. Is the backend running?', type: 'error' })
    } finally {
      setLoading(false)  // always runs — even if there's an error
    }
  }

  async function handleRegister(e) {
    e.preventDefault()
    setLoading(true)
    setMessage(null)
    try {
      const { ok, data } = await registerUser(regUsername, regEmail, regPass)
      if (ok) {
        saveAuth(data.access_token, data.username)
        navigate('/dashboard')
      } else {
        setMessage({ text: data.detail || 'Registration failed', type: 'error' })
      }
    } catch {
      setMessage({ text: 'Cannot connect to server. Is the backend running?', type: 'error' })
    } finally {
      setLoading(false)  // always runs — even if there's an error
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-logo">💰 Money Manager</div>

        {/* Tab switcher */}
        <div className="auth-tabs">
          <button
            className={`tab-btn ${tab === 'login' ? 'active' : ''}`}
            onClick={() => { setTab('login'); setMessage(null) }}
          >
            Login
          </button>
          <button
            className={`tab-btn ${tab === 'register' ? 'active' : ''}`}
            onClick={() => { setTab('register'); setMessage(null) }}
          >
            Register
          </button>
        </div>

        {/* Login Form */}
        {tab === 'login' && (
          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label>Username or Email</label>
              {/* onChange updates state every time user types */}
              <input
                type="text"
                placeholder="Enter username or email"
                value={loginUser2}
                onChange={e => setLoginUser(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input
                type="password"
                placeholder="Enter password"
                value={loginPass}
                onChange={e => setLoginPass(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="btn-primary full-width" disabled={loading}>
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>
        )}

        {/* Register Form */}
        {tab === 'register' && (
          <form onSubmit={handleRegister}>
            <div className="form-group">
              <label>Username</label>
              <input
                type="text"
                placeholder="Choose a username"
                value={regUsername}
                onChange={e => setRegUsername(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                placeholder="Enter your email"
                value={regEmail}
                onChange={e => setRegEmail(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input
                type="password"
                placeholder="Create a password"
                value={regPass}
                onChange={e => setRegPass(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="btn-primary full-width" disabled={loading}>
              {loading ? 'Creating...' : 'Create Account'}
            </button>
          </form>
        )}

        {/* Show error or success message */}
        {message && (
          <div className={`alert alert-${message.type}`}>
            {message.text}
          </div>
        )}
      </div>
    </div>
  )
}
