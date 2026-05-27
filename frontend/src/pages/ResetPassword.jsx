import { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { verifyResetToken, resetPassword } from '../api'

// ══════════════════════════════════════════════════════
// ResetPassword.jsx
//
// URL looks like: /reset-password?token=abc123...
// useSearchParams reads the token from the URL.
//
// Flow:
//  1. Page loads → call /verify-reset-token to check if token is valid
//  2. If valid  → show new password form
//  3. If invalid/expired → show error with link to request a new one
//  4. On submit → call /reset-password → redirect to login on success
// ══════════════════════════════════════════════════════

export default function ResetPassword() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()   // reads ?token=... from URL
  const token = searchParams.get('token')    // extract the token value

  // Token verification state
  const [tokenStatus, setTokenStatus] = useState('checking')  // checking | valid | invalid
  const [maskedEmail, setMaskedEmail] = useState('')
  const [minutesLeft, setMinutesLeft] = useState(0)

  // Form state
  const [password, setPassword]         = useState('')
  const [confirmPassword, setConfirm]   = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading]           = useState(false)
  const [message, setMessage]           = useState(null)
  const [success, setSuccess]           = useState(false)

  // Step 1: verify the token as soon as the page loads
  useEffect(() => {
    if (!token) {
      setTokenStatus('invalid')
      return
    }
    checkToken()
  }, [token])

  async function checkToken() {
    const { ok, data } = await verifyResetToken(token)
    if (ok && data.valid) {
      setTokenStatus('valid')
      setMaskedEmail(data.masked_email)
      setMinutesLeft(data.minutes_left)
    } else {
      setTokenStatus('invalid')
      setMessage({ text: data.detail || 'Invalid or expired link.', type: 'error' })
    }
  }

  // Step 2: submit the new password
  async function handleSubmit(e) {
    e.preventDefault()
    setMessage(null)

    if (password.length < 6) {
      setMessage({ text: 'Password must be at least 6 characters.', type: 'error' })
      return
    }
    if (password !== confirmPassword) {
      setMessage({ text: 'Passwords do not match.', type: 'error' })
      return
    }

    setLoading(true)
    const { ok, data } = await resetPassword(token, password)
    setLoading(false)

    if (ok) {
      setSuccess(true)
      // Redirect to login after 3 seconds
      setTimeout(() => navigate('/'), 3000)
    } else {
      setMessage({ text: data.detail || 'Something went wrong.', type: 'error' })
    }
  }

  // Password strength indicator
  function getStrength(pwd) {
    if (pwd.length === 0) return null
    if (pwd.length < 6)  return { label: 'Too short', color: '#F44336', width: '20%' }
    if (pwd.length < 8)  return { label: 'Weak',      color: '#FF9800', width: '40%' }
    const hasUpper   = /[A-Z]/.test(pwd)
    const hasNumber  = /[0-9]/.test(pwd)
    const hasSpecial = /[^a-zA-Z0-9]/.test(pwd)
    const score = [hasUpper, hasNumber, hasSpecial].filter(Boolean).length
    if (score === 0) return { label: 'Fair',   color: '#FF9800', width: '55%' }
    if (score === 1) return { label: 'Good',   color: '#8BC34A', width: '75%' }
    return              { label: 'Strong', color: '#4CAF50', width: '100%' }
  }

  const strength = getStrength(password)

  // ── LOADING STATE ─────────────────────────────────────────
  if (tokenStatus === 'checking') {
    return (
      <div className="auth-page">
        <div className="auth-container" style={{ textAlign: 'center' }}>
          <div className="auth-logo">💰 Money Manager</div>
          <p style={{ color: '#aaa' }}>Verifying your reset link...</p>
        </div>
      </div>
    )
  }

  // ── INVALID / EXPIRED TOKEN ──────────────────────────────
  if (tokenStatus === 'invalid') {
    return (
      <div className="auth-page">
        <div className="auth-container" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>⛔</div>
          <div className="auth-logo">Invalid Reset Link</div>
          <div className="alert alert-error" style={{ marginBottom: 20 }}>
            {message?.text || 'This reset link is invalid or has expired.'}
          </div>
          <p style={{ color: '#aaa', fontSize: 14, marginBottom: 20 }}>
            Reset links expire after 30 minutes and can only be used once.
          </p>
          <Link to="/forgot-password" className="btn-primary" style={{ display: 'block', textAlign: 'center', marginBottom: 12 }}>
            Request a New Reset Link
          </Link>
          <Link to="/" style={{ color: '#aaa', fontSize: 14 }}>
            ← Back to Login
          </Link>
        </div>
      </div>
    )
  }

  // ── SUCCESS SCREEN ────────────────────────────────────────
  if (success) {
    return (
      <div className="auth-page">
        <div className="auth-container" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
          <div className="auth-logo">Password Reset!</div>
          <div className="alert alert-success" style={{ marginBottom: 20 }}>
            Your password has been updated successfully.
          </div>
          <p style={{ color: '#aaa', fontSize: 14, marginBottom: 20 }}>
            Redirecting you to login in 3 seconds...
          </p>
          <Link to="/" className="btn-primary" style={{ display: 'block', textAlign: 'center' }}>
            Go to Login Now
          </Link>
        </div>
      </div>
    )
  }

  // ── RESET PASSWORD FORM ──────────────────────────────────
  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-logo">💰 Money Manager</div>
        <h3 style={{ marginBottom: 4 }}>Set New Password</h3>

        {/* Show whose account this is and time remaining */}
        <p style={{ color: '#aaa', fontSize: 13, marginBottom: 20 }}>
          Resetting password for <strong style={{ color: '#e0e0e0' }}>{maskedEmail}</strong>
          <span style={{
            marginLeft: 10,
            background: minutesLeft <= 5 ? 'rgba(244,67,54,0.15)' : 'rgba(76,175,80,0.15)',
            color: minutesLeft <= 5 ? '#F44336' : '#4CAF50',
            padding: '2px 8px', borderRadius: 12, fontSize: 12
          }}>
            ⏱ {minutesLeft} min left
          </span>
        </p>

        <form onSubmit={handleSubmit}>
          {/* New password field */}
          <div className="form-group" style={{ marginBottom: 8 }}>
            <label>New Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="At least 6 characters"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoFocus
                style={{ paddingRight: 44 }}
              />
              {/* Toggle show/hide password */}
              <button
                type="button"
                onClick={() => setShowPassword(s => !s)}
                style={{
                  position: 'absolute', right: 10, top: '50%',
                  transform: 'translateY(-50%)', background: 'none',
                  border: 'none', cursor: 'pointer', fontSize: 16, color: '#888'
                }}
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          {/* Password strength bar */}
          {strength && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ height: 4, background: '#2a2a4a', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', width: strength.width,
                  background: strength.color, borderRadius: 2,
                  transition: 'width 0.3s, background 0.3s'
                }} />
              </div>
              <span style={{ fontSize: 11, color: strength.color }}>{strength.label}</span>
            </div>
          )}

          {/* Confirm password field */}
          <div className="form-group" style={{ marginBottom: 20 }}>
            <label>Confirm New Password</label>
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Type your password again"
              value={confirmPassword}
              onChange={e => setConfirm(e.target.value)}
              required
            />
            {/* Live match indicator */}
            {confirmPassword && (
              <span style={{
                fontSize: 12,
                color: password === confirmPassword ? '#4CAF50' : '#F44336'
              }}>
                {password === confirmPassword ? '✓ Passwords match' : '✗ Passwords do not match'}
              </span>
            )}
          </div>

          <button
            type="submit"
            className="btn-primary full-width"
            disabled={loading}
          >
            {loading ? 'Resetting...' : 'Reset Password'}
          </button>
        </form>

        {message && (
          <div className={`alert alert-${message.type}`}>
            {message.text}
          </div>
        )}

        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <Link to="/" style={{ color: '#aaa', fontSize: 13 }}>
            ← Back to Login
          </Link>
        </div>
      </div>
    </div>
  )
}
