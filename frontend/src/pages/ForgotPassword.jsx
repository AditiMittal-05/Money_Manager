import { useState } from 'react'
import { Link } from 'react-router-dom'
import { forgotPassword } from '../api'

// ══════════════════════════════════════════════════════
// ForgotPassword.jsx
// User enters their email here. Backend sends a reset
// link to that email (or prints it to the backend console
// in development mode if email is not configured).
// ══════════════════════════════════════════════════════

export default function ForgotPassword() {
  const [email, setEmail]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [message, setMessage]   = useState(null)
  const [submitted, setSubmitted] = useState(false)  // true after successful submit

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    const { ok, data } = await forgotPassword(email)
    setLoading(false)

    if (ok) {
      // Show success screen — always shown even if email doesn't exist
      // (security: don't reveal whether email is registered)
      setSubmitted(true)
    } else {
      setMessage({ text: data.detail || 'Something went wrong.', type: 'error' })
    }
  }

  // ── SUCCESS SCREEN — shown after form submit ──────────────
  if (submitted) {
    return (
      <div className="auth-page">
        <div className="auth-container" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📧</div>
          <div className="auth-logo">Check Your Email</div>
          <p style={{ color: '#aaa', marginBottom: 24, lineHeight: 1.6 }}>
            If <strong style={{ color: '#e0e0e0' }}>{email}</strong> is registered,
            a password reset link has been sent to it.
          </p>
          <div className="alert alert-success" style={{ textAlign: 'left', marginBottom: 20 }}>
            <strong>Link expires in 30 minutes.</strong><br />
            Check your spam folder if you don't see it.<br /><br />
            <span style={{ fontSize: 12, color: '#aaa' }}>
              If email is not set up, the reset link is printed in the
              <strong style={{ color: '#e0e0e0' }}> backend console window</strong>.
            </span>
          </div>
          <Link to="/" className="btn-primary" style={{ display: 'block', textAlign: 'center' }}>
            ← Back to Login
          </Link>
        </div>
      </div>
    )
  }

  // ── REQUEST FORM ─────────────────────────────────────────
  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-logo">💰 Money Manager</div>
        <h3 style={{ marginBottom: 8 }}>Forgot Password?</h3>
        <p style={{ color: '#aaa', fontSize: 14, marginBottom: 24 }}>
          Enter your registered email and we'll send you a reset link.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ marginBottom: 16 }}>
            <label>Email Address</label>
            <input
              type="email"
              placeholder="Enter your registered email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>

          <button
            type="submit"
            className="btn-primary full-width"
            disabled={loading}
          >
            {loading ? 'Sending...' : 'Send Reset Link'}
          </button>
        </form>

        {message && (
          <div className={`alert alert-${message.type}`}>
            {message.text}
          </div>
        )}

        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <Link to="/" style={{ color: '#aaa', fontSize: 14 }}>
            ← Back to Login
          </Link>
        </div>
      </div>
    </div>
  )
}
