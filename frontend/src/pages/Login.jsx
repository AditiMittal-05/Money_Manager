import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { GoogleLogin } from '@react-oauth/google'
import { loginUser, registerUser, saveAuth, forgotPassword, resetPassword, googleAuth } from '../api'

export default function Login() {
  const navigate = useNavigate()

  // which tab is active: 'login' | 'register' | 'reset'
  const [tab, setTab] = useState('login')
  const [message, setMessage] = useState(null)
  const [loading, setLoading] = useState(false)

  // ── Login fields ──────────────────────────────────────────
  const [loginUser2, setLoginUser] = useState('')
  const [loginPass, setLoginPass]  = useState('')

  // ── Register fields ───────────────────────────────────────
  const [regUsername, setRegUsername] = useState('')
  const [regEmail, setRegEmail]       = useState('')
  const [regPass, setRegPass]         = useState('')

  // ── Reset Password fields ─────────────────────────────────
  const [resetEmail, setResetEmail]       = useState('')
  const [otpSent, setOtpSent]             = useState(false)   // true after OTP is sent
  const [otp, setOtp]                     = useState('')
  const [newPassword, setNewPassword]     = useState('')
  const [confirmPassword, setConfirm]     = useState('')
  const [showNewPass, setShowNewPass]     = useState(false)
  const [countdown, setCountdown]         = useState(0)       // seconds remaining for OTP
  const timerRef = useRef(null)

  // Clear message whenever tab changes
  function switchTab(t) {
    setTab(t)
    setMessage(null)
    setOtpSent(false)
    setOtp('')
    setNewPassword('')
    setConfirm('')
    setCountdown(0)
    clearInterval(timerRef.current)
  }

  // Cleanup timer when component unmounts
  useEffect(() => () => clearInterval(timerRef.current), [])

  // ── GOOGLE LOGIN ──────────────────────────────────────────
  async function handleGoogleLogin(credentialResponse) {
    setLoading(true); setMessage(null)
    const { ok, data } = await googleAuth(credentialResponse.credential)
    setLoading(false)
    if (ok) {
      saveAuth(data.access_token, data.username)
      navigate('/dashboard')
    } else {
      setMessage({ text: data.detail || 'Google login failed. Try again.', type: 'error' })
    }
  }

  // ── LOGIN ─────────────────────────────────────────────────
  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true); setMessage(null)
    try {
      const { ok, data } = await loginUser(loginUser2, loginPass)
      if (ok) { saveAuth(data.access_token, data.username); navigate('/dashboard') }
      else setMessage({ text: data.detail || 'Login failed', type: 'error' })
    } catch {
      setMessage({ text: 'Cannot connect to server. Is the backend running?', type: 'error' })
    } finally { setLoading(false) }
  }

  // ── REGISTER ──────────────────────────────────────────────
  async function handleRegister(e) {
    e.preventDefault()
    setLoading(true); setMessage(null)
    try {
      const { ok, data } = await registerUser(regUsername, regEmail, regPass)
      if (ok) { saveAuth(data.access_token, data.username); navigate('/dashboard') }
      else setMessage({ text: data.detail || 'Registration failed', type: 'error' })
    } catch {
      setMessage({ text: 'Cannot connect to server. Is the backend running?', type: 'error' })
    } finally { setLoading(false) }
  }

  // ── SEND OTP ──────────────────────────────────────────────
  async function handleSendOtp(e) {
    e.preventDefault()
    setLoading(true); setMessage(null)
    const { ok, data } = await forgotPassword(resetEmail)
    setLoading(false)
    if (ok) {
      setOtpSent(true)
      setMessage({ text: '✅ OTP sent! Check your email (or the backend console window).', type: 'success' })
      // Start 10-minute countdown (600 seconds)
      setCountdown(600)
      clearInterval(timerRef.current)
      timerRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) { clearInterval(timerRef.current); return 0 }
          return prev - 1
        })
      }, 1000)
    } else {
      setMessage({ text: data.detail || 'Failed to send OTP.', type: 'error' })
    }
  }

  // ── RESET PASSWORD ────────────────────────────────────────
  async function handleResetPassword(e) {
    e.preventDefault()
    setMessage(null)
    if (otp.length !== 6 || !/^\d{6}$/.test(otp)) {
      setMessage({ text: 'OTP must be exactly 6 digits.', type: 'error' }); return
    }
    if (newPassword.length < 6) {
      setMessage({ text: 'Password must be at least 6 characters.', type: 'error' }); return
    }
    if (newPassword !== confirmPassword) {
      setMessage({ text: 'Passwords do not match.', type: 'error' }); return
    }
    setLoading(true)
    const { ok, data } = await resetPassword(resetEmail, otp, newPassword)
    setLoading(false)
    if (ok) {
      clearInterval(timerRef.current)
      setMessage({ text: '✅ Password reset! Redirecting to login...', type: 'success' })
      setTimeout(() => switchTab('login'), 2500)
    } else {
      setMessage({ text: data.detail || 'Failed to reset password.', type: 'error' })
    }
  }

  // Format countdown as mm:ss
  const mins = String(Math.floor(countdown / 60)).padStart(2, '0')
  const secs = String(countdown % 60).padStart(2, '0')

  // Password strength helper
  function getStrength(pwd) {
    if (!pwd) return null
    if (pwd.length < 6) return { label: 'Too short', color: '#FB7185', w: '20%' }
    const score = [/[A-Z]/, /[0-9]/, /[^a-zA-Z0-9]/].filter(r => r.test(pwd)).length
    const map = [
      { label: 'Weak',   color: '#FFB800', w: '40%' },
      { label: 'Fair',   color: '#FFB800', w: '60%' },
      { label: 'Good',   color: '#34D399', w: '80%' },
      { label: 'Strong', color: '#34D399', w: '100%' },
    ]
    return map[score]
  }
  const strength = getStrength(newPassword)

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-logo">💰 Money Manager</div>

        {/* ── 3 TABS ── */}
        <div className="auth-tabs" style={{ display: 'flex' }}>
          {[['login','Login'],['register','Register'],['reset','Reset Password']].map(([key, label]) => (
            <button
              key={key}
              className={`tab-btn ${tab === key ? 'active' : ''}`}
              onClick={() => switchTab(key)}
              style={{ flex: 1, fontSize: key === 'reset' ? 11 : 14 }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ════════════════════════════════════════
            LOGIN TAB
        ════════════════════════════════════════ */}
        {tab === 'login' && (
          <form onSubmit={handleLogin}>
            <div className="form-group" style={{ marginBottom: 14 }}>
              <label>Username or Email</label>
              <input type="text" placeholder="Enter username or email"
                value={loginUser2} onChange={e => setLoginUser(e.target.value)} required />
            </div>
            <div className="form-group" style={{ marginBottom: 14 }}>
              <label>Password</label>
              <input type="password" placeholder="Enter password"
                value={loginPass} onChange={e => setLoginPass(e.target.value)} required />
            </div>
            <button type="submit" className="btn-primary full-width" disabled={loading}>
              {loading ? 'Logging in...' : 'Login'}
            </button>
            <div style={{ textAlign: 'right', marginTop: 10 }}>
              <button
                type="button"
                onClick={() => switchTab('reset')}
                style={{ background: 'none', border: 'none', color: '#818CF8',
                         fontSize: 13, cursor: 'pointer', padding: 0 }}
              >
                Forgot Password?
              </button>
            </div>

            {/* ── GOOGLE LOGIN DIVIDER + BUTTON ── */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10, margin: '18px 0 14px'
            }}>
              <div style={{ flex: 1, height: 1, background: 'rgba(139,92,246,0.20)' }} />
              <span style={{ color: '#7B78A0', fontSize: 12, whiteSpace: 'nowrap' }}>or continue with</span>
              <div style={{ flex: 1, height: 1, background: 'rgba(139,92,246,0.20)' }} />
            </div>

            {/* GoogleLogin renders the official Google button automatically */}
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <GoogleLogin
                onSuccess={handleGoogleLogin}
                onError={() => setMessage({ text: 'Google sign-in was cancelled or failed.', type: 'error' })}
                theme="filled_black"
                shape="rectangular"
                size="large"
                text="signin_with"
                width="360"
              />
            </div>
          </form>
        )}

        {/* ════════════════════════════════════════
            REGISTER TAB
        ════════════════════════════════════════ */}
        {tab === 'register' && (
          <form onSubmit={handleRegister}>
            <div className="form-group" style={{ marginBottom: 14 }}>
              <label>Username</label>
              <input type="text" placeholder="Choose a username"
                value={regUsername} onChange={e => setRegUsername(e.target.value)} required />
            </div>
            <div className="form-group" style={{ marginBottom: 14 }}>
              <label>Email</label>
              <input type="email" placeholder="Enter your email"
                value={regEmail} onChange={e => setRegEmail(e.target.value)} required />
            </div>
            <div className="form-group" style={{ marginBottom: 14 }}>
              <label>Password</label>
              <input type="password" placeholder="Create a password"
                value={regPass} onChange={e => setRegPass(e.target.value)} required />
            </div>
            <button type="submit" className="btn-primary full-width" disabled={loading}>
              {loading ? 'Creating...' : 'Create Account'}
            </button>

            {/* ── GOOGLE REGISTER DIVIDER + BUTTON ── */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10, margin: '18px 0 14px'
            }}>
              <div style={{ flex: 1, height: 1, background: 'rgba(139,92,246,0.20)' }} />
              <span style={{ color: '#7B78A0', fontSize: 12, whiteSpace: 'nowrap' }}>or sign up with</span>
              <div style={{ flex: 1, height: 1, background: 'rgba(139,92,246,0.20)' }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <GoogleLogin
                onSuccess={handleGoogleLogin}
                onError={() => setMessage({ text: 'Google sign-up was cancelled or failed.', type: 'error' })}
                theme="filled_black"
                shape="rectangular"
                size="large"
                text="signup_with"
                width="360"
              />
            </div>
          </form>
        )}

        {/* ════════════════════════════════════════
            RESET PASSWORD TAB  — 2-step flow
        ════════════════════════════════════════ */}
        {tab === 'reset' && (
          <div>
            {/* ── STEP INDICATOR ── */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20, gap: 8 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%', display: 'flex',
                alignItems: 'center', justifyContent: 'center', fontSize: 13,
                fontWeight: 'bold', flexShrink: 0,
                background: '#818CF8', color: 'white'
              }}>1</div>
              <div style={{ height: 2, flex: 1,
                background: otpSent ? '#818CF8' : 'rgba(139,92,246,0.20)' }} />
              <div style={{
                width: 28, height: 28, borderRadius: '50%', display: 'flex',
                alignItems: 'center', justifyContent: 'center', fontSize: 13,
                fontWeight: 'bold', flexShrink: 0,
                background: otpSent ? '#818CF8' : 'rgba(139,92,246,0.20)',
                color: otpSent ? 'white' : '#A78BFA'
              }}>2</div>
            </div>

            {/* ── STEP 1: Enter email ── */}
            {!otpSent ? (
              <form onSubmit={handleSendOtp}>
                <p style={{ color: '#7B78A0', fontSize: 13, marginBottom: 16 }}>
                  Enter your registered email to receive a 6-digit OTP.
                </p>
                <div className="form-group" style={{ marginBottom: 16 }}>
                  <label>Email Address</label>
                  <input type="email" placeholder="Enter your registered email"
                    value={resetEmail} onChange={e => setResetEmail(e.target.value)}
                    required autoFocus />
                </div>
                <button type="submit" className="btn-primary full-width" disabled={loading}>
                  {loading ? 'Sending OTP...' : 'Send OTP to Email'}
                </button>
              </form>
            ) : (
              /* ── STEP 2: Enter OTP + new password ── */
              <form onSubmit={handleResetPassword}>
                <p style={{ color: '#7B78A0', fontSize: 13, marginBottom: 16, lineHeight: 1.6 }}>
                  Enter the 6-digit OTP sent to{' '}
                  <strong style={{ color: '#EDE9FE' }}>{resetEmail}</strong>
                  {countdown > 0 && (
                    <span style={{
                      marginLeft: 8, fontSize: 12,
                      color: countdown < 60 ? '#FB7185' : '#34D399',
                      background: countdown < 60 ? 'rgba(255,107,107,0.10)' : 'rgba(0,200,150,0.10)',
                      padding: '2px 8px', borderRadius: 10
                    }}>
                      ⏱ {mins}:{secs}
                    </span>
                  )}
                  {countdown === 0 && (
                    <span style={{ marginLeft: 8, fontSize: 12, color: '#FB7185' }}>
                      OTP expired —{' '}
                      <button type="button" onClick={() => { setOtpSent(false); setOtp('') }}
                        style={{ background:'none',border:'none',color:'#818CF8',
                                 cursor:'pointer',fontSize:12,padding:0,textDecoration:'underline' }}>
                        resend
                      </button>
                    </span>
                  )}
                </p>

                {/* OTP input — big boxes for each digit */}
                <div className="form-group" style={{ marginBottom: 16 }}>
                  <label>6-Digit OTP</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="e.g. 472819"
                    value={otp}
                    onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    style={{
                      letterSpacing: 10, fontSize: 22, textAlign: 'center',
                      fontFamily: 'monospace', fontWeight: 'bold'
                    }}
                    required
                    autoFocus
                  />
                  {otp.length > 0 && otp.length < 6 && (
                    <span style={{ fontSize: 11, color: '#FFB800' }}>
                      {6 - otp.length} more digit{6 - otp.length > 1 ? 's' : ''} needed
                    </span>
                  )}
                  {otp.length === 6 && (
                    <span style={{ fontSize: 11, color: '#34D399' }}>✓ OTP complete</span>
                  )}
                </div>

                {/* New password */}
                <div className="form-group" style={{ marginBottom: 6 }}>
                  <label>New Password</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showNewPass ? 'text' : 'password'}
                      placeholder="At least 6 characters"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      style={{ paddingRight: 40 }}
                      required
                    />
                    <button type="button" onClick={() => setShowNewPass(s => !s)}
                      style={{ position:'absolute', right:10, top:'50%',
                               transform:'translateY(-50%)', background:'none',
                               border:'none', cursor:'pointer', fontSize:16, color:'#7B78A0' }}>
                      {showNewPass ? '🙈' : '👁️'}
                    </button>
                  </div>
                </div>

                {/* Password strength bar */}
                {strength && (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ height: 3, background: 'rgba(139,92,246,0.20)', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: strength.w, background: strength.color,
                                    borderRadius: 2, transition: 'width 0.3s' }} />
                    </div>
                    <span style={{ fontSize: 11, color: strength.color }}>{strength.label}</span>
                  </div>
                )}

                {/* Confirm password */}
                <div className="form-group" style={{ marginBottom: 20 }}>
                  <label>Confirm New Password</label>
                  <input
                    type={showNewPass ? 'text' : 'password'}
                    placeholder="Type password again"
                    value={confirmPassword}
                    onChange={e => setConfirm(e.target.value)}
                    required
                  />
                  {confirmPassword && (
                    <span style={{ fontSize: 11,
                      color: newPassword === confirmPassword ? '#34D399' : '#FB7185' }}>
                      {newPassword === confirmPassword ? '✓ Passwords match' : '✗ Do not match'}
                    </span>
                  )}
                </div>

                <button type="submit" className="btn-primary full-width" disabled={loading}>
                  {loading ? 'Resetting...' : 'Reset Password'}
                </button>

                {/* Resend option */}
                <div style={{ textAlign: 'center', marginTop: 12 }}>
                  <button type="button"
                    onClick={() => { setOtpSent(false); setOtp(''); setMessage(null) }}
                    style={{ background:'none', border:'none', color:'#7B78A0',
                             fontSize:12, cursor:'pointer' }}>
                    ← Change email / Resend OTP
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* Error / success message — shown below whichever form is active */}
        {message && (
          <div className={`alert alert-${message.type}`} style={{ marginTop: 14 }}>
            {message.text}
          </div>
        )}
      </div>
    </div>
  )
}
