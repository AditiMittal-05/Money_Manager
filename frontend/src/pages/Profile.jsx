import { useState, useEffect, useRef } from 'react'
import Sidebar from '../components/Sidebar'
import {
  API_BASE,
  getProfileStats,
  updateProfile,
  uploadAvatar,
  deleteAvatar,
  changePassword,
} from '../api'
import { setCurrencyPref, fmt, useCurrency } from '../utils/currency'

// ── Circular SVG progress for health score ──────────────
function CircularScore({ score, color }) {
  const r = 48
  const circ = 2 * Math.PI * r
  const offset = circ * (1 - score / 100)
  return (
    <svg width="124" height="124" viewBox="0 0 124 124">
      {/* Track ring — uses CSS var so it adapts to theme */}
      <circle cx="62" cy="62" r={r} fill="none"
        style={{ stroke: 'var(--border)' }} strokeWidth="9"
      />
      <circle
        cx="62" cy="62" r={r} fill="none" stroke={color} strokeWidth="9"
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        transform="rotate(-90 62 62)"
        style={{ transition: 'stroke-dashoffset 1.2s ease' }}
      />
      <text x="62" y="57" textAnchor="middle" fontSize="24" fontWeight="800" fontFamily="Inter"
        style={{ fill: 'var(--text)' }}
      >{score}</text>
      <text x="62" y="73" textAnchor="middle" fontSize="11" fontFamily="Inter"
        style={{ fill: 'var(--muted)' }}
      >/ 100</text>
    </svg>
  )
}

// ── Toggle switch ────────────────────────────────────────
function Toggle({ checked, onChange }) {
  return (
    <label style={{ position: 'relative', display: 'inline-block', width: 38, height: 20, cursor: 'pointer', flexShrink: 0 }}>
      <input type="checkbox" checked={checked} onChange={onChange} style={{ opacity: 0, width: 0, height: 0 }} />
      <span style={{
        position: 'absolute', inset: 0, borderRadius: 999,
        background: checked ? '#8B5CF6' : 'rgba(100,116,139,0.25)',
        transition: 'background 0.2s',
        boxShadow: checked ? '0 0 10px rgba(139,92,246,0.40)' : 'none',
      }}>
        <span style={{
          position: 'absolute', top: 2, left: checked ? 18 : 2,
          width: 16, height: 16, borderRadius: '50%', background: '#fff',
          transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
        }} />
      </span>
    </label>
  )
}

function healthColor(score) {
  if (score >= 80) return '#8B5CF6'
  if (score >= 60) return '#34D399'
  if (score >= 40) return '#FCD34D'
  return '#FB7185'
}

// ─────────────────────────────────────────────────────────
export default function Profile() {
  useCurrency()  // re-render financial stats when currency changes
  const [profile, setProfile] = useState(null)
  const [editMode, setEditMode] = useState(false)
  const [editForm, setEditForm] = useState({
    full_name: '', phone: '', country: 'India', currency_pref: 'INR',
    email_notifications: true, budget_alerts: true,
  })
  const [avatarPreview, setAvatarPreview] = useState(null)
  const [avatarFile, setAvatarFile]       = useState(null)
  const [pwForm, setPwForm] = useState({ current: '', newPw: '', confirm: '' })
  const [showPw, setShowPw] = useState(false)
  const [msg, setMsg]       = useState(null)
  const [pwMsg, setPwMsg]   = useState(null)

  // Theme state — reads from what's currently applied to <html>
  const [theme, setTheme] = useState(
    () => document.documentElement.dataset.theme || localStorage.getItem('theme') || 'dark'
  )

  const fileRef = useRef()

  useEffect(() => { load() }, [])

  async function load() {
    const data = await getProfileStats()
    if (data) {
      setProfile(data)
      const currPref = data.currency_pref || 'INR'
      setCurrencyPref(currPref)   // sync localStorage + notify all pages
      setEditForm({
        full_name:           data.full_name || '',
        phone:               data.phone || '',
        country:             data.country || 'India',
        currency_pref:       currPref,
        email_notifications: data.email_notifications !== false,
        budget_alerts:       data.budget_alerts !== false,
      })
    }
  }

  function flash(text, type = 'success') {
    setMsg({ text, type })
    setTimeout(() => setMsg(null), 3500)
  }

  // ── Theme switching ──────────────────────────────────────
  function switchTheme(newTheme) {
    setTheme(newTheme)
    document.documentElement.dataset.theme = newTheme
    localStorage.setItem('theme', newTheme)
  }

  // ── Avatar handlers ──────────────────────────────────────
  function handleAvatarChange(e) {
    const file = e.target.files[0]
    if (!file) return
    setAvatarFile(file)
    const reader = new FileReader()
    reader.onload = ev => setAvatarPreview(ev.target.result)
    reader.readAsDataURL(file)
  }

  async function handleAvatarUpload() {
    if (!avatarFile) return
    const fd = new FormData()
    fd.append('avatar', avatarFile)
    const res = await uploadAvatar(fd)
    if (res.ok) {
      flash('Profile picture updated!')
      setAvatarFile(null)
      setAvatarPreview(null)
      load()
    } else {
      flash(res.data?.detail || 'Upload failed', 'error')
    }
  }

  async function handleAvatarDelete() {
    if (!confirm('Remove profile picture?')) return
    await deleteAvatar()
    setAvatarPreview(null)
    flash('Profile picture removed')
    load()
  }

  // ── Profile update ───────────────────────────────────────
  async function handleProfileUpdate(e) {
    e.preventDefault()
    const fd = new FormData()
    Object.entries(editForm).forEach(([k, v]) => fd.append(k, String(v)))
    const data = await updateProfile(fd)
    if (data) {
      setCurrencyPref(editForm.currency_pref)  // instant update across all pages
      flash('Profile updated!')
      setEditMode(false)
      load()
    }
  }

  async function savePreference(key, value) {
    const next = { ...editForm, [key]: value }
    setEditForm(next)
    const fd = new FormData()
    Object.entries(next).forEach(([k, v]) => fd.append(k, String(v)))
    await updateProfile(fd)
  }

  // ── Change password ──────────────────────────────────────
  async function handlePwChange(e) {
    e.preventDefault()
    if (pwForm.newPw !== pwForm.confirm) {
      setPwMsg({ text: 'Passwords do not match', type: 'error' }); return
    }
    const fd = new FormData()
    fd.append('current_password', pwForm.current)
    fd.append('new_password', pwForm.newPw)
    const data = await changePassword(fd)
    if (data?.message) {
      setPwMsg({ text: data.message, type: 'success' })
      setPwForm({ current: '', newPw: '', confirm: '' })
      setTimeout(() => { setPwMsg(null); setShowPw(false) }, 2800)
    } else {
      setPwMsg({ text: data?.detail || 'Failed', type: 'error' })
    }
  }

  // ── Loading state ────────────────────────────────────────
  if (!profile) return (
    <div className="layout">
      <Sidebar />
      <main className="main-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p className="empty-msg">Loading profile…</p>
      </main>
    </div>
  )

  const hColor      = healthColor(profile.health.score)
  const displayName = profile.full_name || profile.username
  const initials    = displayName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
  const avatarSrc   = avatarPreview || (profile.avatar_url ? `${API_BASE}/uploads/${profile.avatar_url}` : null)

  // ── Shared style objects using CSS variables ─────────────
  const card = {
    background: 'var(--card)',
    borderRadius: 16,
    border: '1px solid var(--border)',
    padding: '18px 20px',
    boxShadow: 'var(--shadow-sm)',
  }
  const lbl = { color: 'var(--muted)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em' }
  const val = { color: 'var(--text)',  fontSize: 13, fontWeight: 500 }

  // Theme button styles
  const themeBtnActive = {
    flex: 1, padding: '6px 0', borderRadius: 8, cursor: 'pointer',
    border: '1px solid rgba(124,58,237,0.45)',
    background: 'rgba(124,58,237,0.14)',
    color: 'var(--accent)', fontSize: 11, fontWeight: 700,
  }
  const themeBtnInactive = {
    flex: 1, padding: '6px 0', borderRadius: 8, cursor: 'pointer',
    border: '1px solid var(--border)',
    background: 'transparent',
    color: 'var(--muted)', fontSize: 11, fontWeight: 400,
  }

  return (
    <div className="layout">
      <Sidebar />
      <main className="main-content" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

        {/* ── Topbar ── */}
        <div className="topbar" style={{ flexShrink: 0, alignItems: 'center' }}>
          <h1>Profile</h1>
          {msg && (
            <div className={`alert alert-${msg.type}`} style={{ margin: 0, padding: '6px 16px', fontSize: 13, borderRadius: 8 }}>
              {msg.text}
            </div>
          )}
        </div>

        {/* ── 2-Column layout ── */}
        <div style={{ display: 'flex', gap: 14, flex: 1, minHeight: 0 }}>

          {/* ════════════════ LEFT COLUMN ════════════════ */}
          <div style={{ width: 310, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto', paddingRight: 2, paddingBottom: 4 }}>

            {/* ── Card 1: Avatar + basic info ── */}
            <div style={card}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 14 }}>
                <div
                  style={{ position: 'relative', width: 78, height: 78, cursor: 'pointer' }}
                  onClick={() => fileRef.current?.click()}
                  title="Click to change photo"
                >
                  <div style={{
                    width: '100%', height: '100%', borderRadius: '50%',
                    background: avatarSrc ? 'transparent' : 'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: '3px solid rgba(139,92,246,0.40)',
                    boxShadow: '0 0 24px rgba(139,92,246,0.25)',
                    overflow: 'hidden',
                  }}>
                    {avatarSrc
                      ? <img src={avatarSrc} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <span style={{ fontSize: 26, fontWeight: 800, color: '#fff', letterSpacing: -1 }}>{initials}</span>
                    }
                  </div>
                  {/* Camera hover overlay */}
                  <div style={{
                    position: 'absolute', inset: 0, borderRadius: '50%',
                    background: 'rgba(0,0,0,0.55)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    opacity: 0, transition: 'opacity 0.18s', fontSize: 18,
                  }}
                    onMouseEnter={e => e.currentTarget.style.opacity = 1}
                    onMouseLeave={e => e.currentTarget.style.opacity = 0}
                  >📷</div>
                </div>
                <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarChange} />

                {avatarFile ? (
                  <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
                    <button className="btn-primary" style={{ padding: '4px 14px', fontSize: 12 }} onClick={handleAvatarUpload}>Save</button>
                    <button className="btn-secondary" style={{ padding: '4px 12px', fontSize: 12 }}
                      onClick={() => { setAvatarFile(null); setAvatarPreview(null) }}>Cancel</button>
                  </div>
                ) : profile.avatar_url ? (
                  <button style={{ marginTop: 6, background: 'none', border: 'none', color: '#FB7185', fontSize: 11, cursor: 'pointer' }}
                    onClick={handleAvatarDelete}>Remove photo</button>
                ) : (
                  <button style={{ marginTop: 6, background: 'none', border: 'none', color: 'var(--accent)', fontSize: 11, cursor: 'pointer' }}
                    onClick={() => fileRef.current?.click()}>+ Upload photo</button>
                )}
              </div>

              {/* Name / email / badges */}
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>{displayName}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>@{profile.username}</div>
                <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 3 }}>{profile.email}</div>
                <div style={{ marginTop: 10, display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
                  <span style={{ background: 'rgba(139,92,246,0.14)', color: '#A78BFA', borderRadius: 20, padding: '2px 10px', fontSize: 10, fontWeight: 700, letterSpacing: '0.05em' }}>
                    FREE ACCOUNT
                  </span>
                  {profile.google_linked && (
                    <span style={{ background: 'rgba(52,211,153,0.12)', color: '#34D399', borderRadius: 20, padding: '2px 10px', fontSize: 10, fontWeight: 700 }}>
                      GOOGLE
                    </span>
                  )}
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border)', marginTop: 14, paddingTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ ...lbl, fontSize: 10 }}>Joined {profile.joined_date}</span>
                <button className="btn-secondary" style={{ padding: '4px 12px', fontSize: 11 }} onClick={() => setEditMode(!editMode)}>
                  {editMode ? 'Cancel' : '✏️ Edit Profile'}
                </button>
              </div>
            </div>

            {/* ── Card 2: Personal Info ── */}
            <div style={card}>
              <h3 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}>
                👤 Personal Information
              </h3>

              {editMode ? (
                <form onSubmit={handleProfileUpdate} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[
                    { label: 'Full Name', key: 'full_name', type: 'text', placeholder: 'Your full name' },
                    { label: 'Phone',     key: 'phone',     type: 'tel',  placeholder: '+91 98765 43210' },
                    { label: 'Country',   key: 'country',   type: 'text', placeholder: 'India' },
                  ].map(({ label, key, type, placeholder }) => (
                    <div key={key} className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ fontSize: 11 }}>{label}</label>
                      <input type={type} placeholder={placeholder}
                        value={editForm[key]}
                        onChange={e => setEditForm(f => ({ ...f, [key]: e.target.value }))}
                        style={{ fontSize: 13, padding: '7px 10px' }}
                      />
                    </div>
                  ))}
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ fontSize: 11 }}>Currency</label>
                    <select value={editForm.currency_pref}
                      onChange={e => setEditForm(f => ({ ...f, currency_pref: e.target.value }))}
                      style={{ fontSize: 13 }}>
                      <option value="INR">INR — Indian Rupee (₹)</option>
                      <option value="USD">USD — US Dollar ($)</option>
                      <option value="EUR">EUR — Euro (€)</option>
                      <option value="GBP">GBP — British Pound (£)</option>
                      <option value="AED">AED — UAE Dirham (د.إ)</option>
                      <option value="SGD">SGD — Singapore Dollar (S$)</option>
                      <option value="JPY">JPY — Japanese Yen (¥)</option>
                      <option value="CAD">CAD — Canadian Dollar (C$)</option>
                      <option value="AUD">AUD — Australian Dollar (A$)</option>
                    </select>
                  </div>
                  <button type="submit" className="btn-primary" style={{ fontSize: 12, padding: '8px' }}>
                    Save Changes
                  </button>
                </form>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                  {[
                    { label: 'Full Name', value: profile.full_name || '—' },
                    { label: 'Email',     value: profile.email },
                    { label: 'Phone',     value: profile.phone || '—' },
                    { label: 'Currency',  value: profile.currency_pref || 'INR' },
                    { label: 'Country',   value: profile.country || 'India' },
                  ].map(({ label, value }) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                      <span style={lbl}>{label}</span>
                      <span style={{ ...val, textAlign: 'right', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Card 3: Security Center ── */}
            <div style={card}>
              <h3 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}>
                🔐 Security Center
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
                {[
                  { label: 'Google Account', value: profile.google_linked ? '✅ Linked'  : '— Not linked', color: profile.google_linked ? '#34D399' : 'var(--muted)' },
                  { label: 'PIN Lock',       value: profile.has_pin       ? '✅ Enabled' : '⚠️ Not set',   color: profile.has_pin       ? '#34D399' : '#FCD34D'     },
                  { label: 'Last Login',     value: profile.last_login,                                    color: 'var(--text-2)'                                    },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={lbl}>{label}</span>
                    <span style={{ fontSize: 11, color, fontWeight: 600 }}>{value}</span>
                  </div>
                ))}
              </div>

              <button
                className="btn-secondary"
                style={{ width: '100%', fontSize: 12, padding: '7px' }}
                onClick={() => { setShowPw(!showPw); setPwMsg(null) }}
              >
                {showPw ? '✕ Cancel' : '🔑 Change Password'}
              </button>

              {showPw && (
                <form onSubmit={handlePwChange} style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[
                    { label: 'Current Password', key: 'current' },
                    { label: 'New Password',      key: 'newPw'   },
                    { label: 'Confirm New',        key: 'confirm' },
                  ].map(({ label, key }) => (
                    <div key={key} className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ fontSize: 10 }}>{label}</label>
                      <input type="password"
                        value={pwForm[key]}
                        onChange={e => setPwForm(f => ({ ...f, [key]: e.target.value }))}
                        style={{ fontSize: 12, padding: '6px 10px' }}
                      />
                    </div>
                  ))}
                  {pwMsg && (
                    <div className={`alert alert-${pwMsg.type}`} style={{ padding: '6px 10px', fontSize: 11, margin: 0 }}>{pwMsg.text}</div>
                  )}
                  <button type="submit" className="btn-primary" style={{ fontSize: 12, padding: '7px' }}>
                    Update Password
                  </button>
                </form>
              )}
            </div>
          </div>

          {/* ════════════════ RIGHT COLUMN ════════════════ */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto', paddingBottom: 4 }}>

            {/* ── Row 1: 5 stat KPI tiles ── */}
            <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
              {[
                { icon: '💳', label: 'Transactions', value: profile.stats.total_transactions, color: '#818CF8', glow: 'rgba(129,140,248,0.10)' },
                { icon: '📊', label: 'Budgets',       value: profile.stats.active_budgets,     color: '#A78BFA', glow: 'rgba(167,139,250,0.10)' },
                { icon: '🏷️', label: 'Categories',   value: profile.stats.categories_count,   color: '#34D399', glow: 'rgba(52,211,153,0.10)'  },
                { icon: '🔁', label: 'Recurring',     value: profile.stats.recurring_count,    color: '#38BDF8', glow: 'rgba(56,189,248,0.10)'  },
                { icon: '📅', label: 'Days Active',   value: profile.stats.days_using,         color: '#FCD34D', glow: 'rgba(252,211,77,0.10)'  },
              ].map(({ icon, label, value, color, glow }) => (
                <div key={label} style={{
                  flex: 1, minWidth: 0,
                  background: glow, border: `1px solid ${color}28`,
                  borderRadius: 14, padding: '14px 10px', textAlign: 'center',
                  boxShadow: 'var(--shadow-xs)',
                }}>
                  <div style={{ fontSize: 20, marginBottom: 6 }}>{icon}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
                  <div style={{ fontSize: 9, color: 'var(--muted)', marginTop: 4, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
                </div>
              ))}
            </div>

            {/* ── Row 2: Financial Summary + Health Score ── */}
            <div style={{ display: 'flex', gap: 12, flexShrink: 0 }}>

              {/* Financial Summary */}
              <div style={{ ...card, flex: 1 }}>
                <h3 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}>💰 Financial Summary</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {[
                    { label: 'Total Income',   value: fmt(profile.financial.total_income),              color: '#34D399', bg: 'rgba(52,211,153,0.10)'  },
                    { label: 'Total Expenses', value: fmt(profile.financial.total_expense),             color: '#FB7185', bg: 'rgba(251,113,133,0.10)' },
                    { label: 'Total Savings',  value: fmt(Math.max(0, profile.financial.total_savings)), color: '#38BDF8', bg: 'rgba(56,189,248,0.10)'  },
                    { label: 'Savings Rate',   value: `${profile.financial.savings_rate.toFixed(1)}%`,                    color: '#FCD34D', bg: 'rgba(252,211,77,0.10)'   },
                  ].map(({ label, value, color, bg }) => (
                    <div key={label} style={{
                      background: bg, border: `1px solid ${color}22`, borderRadius: 12, padding: '12px 14px',
                    }}>
                      <div style={{ ...lbl, marginBottom: 5 }}>{label}</div>
                      <div style={{ fontSize: 17, fontWeight: 800, color }}>{value}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Health Score */}
              <div style={{ ...card, width: 210, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                <h3 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', alignSelf: 'flex-start', width: '100%' }}>🏥 Financial Health</h3>
                <CircularScore score={profile.health.score} color={hColor} />
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: hColor }}>{profile.health.status}</div>
                  <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>Health Score</div>
                </div>
                {/* Progress bar */}
                <div style={{ width: '100%', background: 'var(--border)', borderRadius: 999, height: 4 }}>
                  <div style={{
                    width: `${profile.health.score}%`, height: '100%',
                    background: hColor, borderRadius: 999,
                    boxShadow: `0 0 8px ${hColor}80`,
                    transition: 'width 1.2s ease',
                  }} />
                </div>
              </div>
            </div>

            {/* ── Row 3: Achievements + Preferences ── */}
            <div style={{ display: 'flex', gap: 12, flex: 1, minHeight: 0 }}>

              {/* Achievements */}
              <div style={{ ...card, flex: 1, display: 'flex', flexDirection: 'column' }}>
                <h3 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 14, flexShrink: 0 }}>🏆 Achievements</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {profile.achievements.map((ach, i) => (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '8px 10px', borderRadius: 10,
                      background: ach.earned ? 'rgba(139,92,246,0.10)' : 'var(--card-hi)',
                      border: `1px solid ${ach.earned ? 'rgba(139,92,246,0.28)' : 'var(--border)'}`,
                      opacity: ach.earned ? 1 : 0.45,
                      transition: 'opacity 0.2s',
                    }}>
                      <span style={{ fontSize: 18, filter: ach.earned ? 'none' : 'grayscale(1)', flexShrink: 0 }}>{ach.icon}</span>
                      <span style={{
                        fontSize: 11, lineHeight: 1.3,
                        color: ach.earned ? 'var(--text-2)' : 'var(--muted)',
                        fontWeight: ach.earned ? 600 : 400,
                      }}>{ach.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Preferences */}
              <div style={{ ...card, width: 210, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <h3 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>⚙️ Preferences</h3>

                {/* Notification toggles */}
                {[
                  { label: 'Email Notifications', key: 'email_notifications' },
                  { label: 'Budget Alerts',        key: 'budget_alerts'       },
                ].map(({ label, key }) => (
                  <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: 'var(--text-2)', flex: 1 }}>{label}</span>
                    <Toggle
                      checked={editForm[key]}
                      onChange={e => savePreference(key, e.target.checked)}
                    />
                  </div>
                ))}

                {/* Theme switcher */}
                <div>
                  <div style={{ ...lbl, marginBottom: 8 }}>Appearance</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      style={theme === 'dark' ? themeBtnActive : themeBtnInactive}
                      onClick={() => switchTheme('dark')}
                    >🌙 Dark</button>
                    <button
                      style={theme === 'light' ? themeBtnActive : themeBtnInactive}
                      onClick={() => switchTheme('light')}
                    >☀️ Light</button>
                  </div>
                </div>

                {/* Currency display */}
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                  <div style={{ ...lbl, marginBottom: 4 }}>Currency</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent)' }}>
                    {({ INR:'₹', USD:'$', EUR:'€', GBP:'£', AED:'د.إ', SGD:'S$', JPY:'¥', CAD:'C$', AUD:'A$' })[editForm.currency_pref] || editForm.currency_pref}{' '}{editForm.currency_pref}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
