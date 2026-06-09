import { useState, useEffect } from 'react'
import Sidebar from '../components/Sidebar'
import { getProfile, getNotifications, markNotifRead, markAllNotifsRead, setPin, verifyPin } from '../api'

export default function Settings() {
  const [profile, setProfile] = useState(null)
  const [notifications, setNotifications] = useState([])
  const [pinInput, setPinInput] = useState('')
  const [pinVerify, setPinVerify] = useState('')
  const [pinMsg, setPinMsg] = useState(null)

  useEffect(() => {
    loadProfile()
    loadNotifications()
  }, [])

  async function loadProfile() {
    const data = await getProfile()
    if (data) setProfile(data)
  }

  async function loadNotifications() {
    const data = await getNotifications()
    if (data) setNotifications(data)
  }

  async function handleSetPin(e) {
    e.preventDefault()
    if (!/^\d{4}$/.test(pinInput)) {
      setPinMsg({ text: 'PIN must be exactly 4 digits', type: 'error' }); return
    }
    const data = await setPin(pinInput)
    if (data) {
      setPinMsg({ text: '✅ PIN saved!', type: 'success' })
      setPinInput('')
      loadProfile()
    }
  }

  async function handleVerifyPin(e) {
    e.preventDefault()
    const data = await verifyPin(pinVerify)
    if (data?.message === 'PIN verified') {
      setPinMsg({ text: '✅ PIN is correct!', type: 'success' })
    } else {
      setPinMsg({ text: '❌ Incorrect PIN', type: 'error' })
    }
    setPinVerify('')
  }

  async function handleMarkRead(id) {
    await markNotifRead(id)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
  }

  async function handleMarkAllRead() {
    await markAllNotifsRead()
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
  }

  const boxStyle = {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    overflow: 'hidden',
  }

  return (
    <div className="layout">
      <Sidebar />
      <main className="main-content" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div className="topbar" style={{ flexShrink: 0 }}><h1>Settings</h1></div>

        {/* ── ROW 1: Profile + Security ── */}
        <div style={{ display: 'flex', gap: 16, flex: 1, minHeight: 0, marginBottom: 16 }}>

          {/* Profile */}
          <div className="section-box" style={boxStyle}>
            <h3 style={{ marginBottom: 12, flexShrink: 0 }}>👤 Profile</h3>
            {profile ? (
              <div className="txn-row" style={{ marginTop: 4 }}>
                <div className="txn-info">
                  <span className="txn-desc">👤 {profile.username}</span>
                  <span className="txn-date">📧 {profile.email}</span>
                </div>
                <span style={{ color: profile.has_pin ? '#34D399' : '#FFB800', whiteSpace: 'nowrap' }}>
                  {profile.has_pin ? '🔐 PIN set' : '⚠️ No PIN set'}
                </span>
              </div>
            ) : <p className="empty-msg">Loading...</p>}
          </div>

          {/* Security PIN */}
          <div className="section-box" style={boxStyle}>
            <h3 style={{ marginBottom: 8, flexShrink: 0 }}>🔐 Security — PIN Lock</h3>
            <p style={{ color: '#7B78A0', marginBottom: 12, fontSize: 13, flexShrink: 0 }}>
              Set a 4-digit PIN to lock the app.
            </p>
            <form onSubmit={handleSetPin}>
              <div className="form-row">
                <div className="form-group">
                  <label>Set / Change PIN</label>
                  <input
                    type="password" maxLength={4} placeholder="4-digit PIN"
                    value={pinInput} onChange={e => setPinInput(e.target.value)}
                  />
                </div>
                <div className="form-group" style={{ alignSelf: 'flex-end' }}>
                  <button type="submit" className="btn-primary">Save PIN</button>
                </div>
              </div>
            </form>

            {profile?.has_pin && (
              <form onSubmit={handleVerifyPin} style={{ marginTop: 12 }}>
                <div className="form-row">
                  <div className="form-group">
                    <label>Verify PIN</label>
                    <input
                      type="password" maxLength={4} placeholder="Enter PIN to verify"
                      value={pinVerify} onChange={e => setPinVerify(e.target.value)}
                    />
                  </div>
                  <div className="form-group" style={{ alignSelf: 'flex-end' }}>
                    <button type="submit" className="btn-secondary">Verify</button>
                  </div>
                </div>
              </form>
            )}

            {pinMsg && (
              <div className={`alert alert-${pinMsg.type}`} style={{ marginTop: 8 }}>
                {pinMsg.text}
              </div>
            )}
          </div>
        </div>

        {/* ── ROW 2: Notifications + Backup ── */}
        <div style={{ display: 'flex', gap: 16, flex: 1, minHeight: 0 }}>

          {/* Notifications */}
          <div className="section-box" style={{ ...boxStyle, overflow: 'auto' }}>
            <div className="section-header" style={{ flexShrink: 0 }}>
              <h3>🔔 Notifications</h3>
              <button className="btn-secondary" onClick={handleMarkAllRead}>Mark All Read</button>
            </div>
            {notifications.length === 0 ? (
              <p className="empty-msg">No notifications yet. Budget alerts will appear here.</p>
            ) : (
              notifications.map(n => (
                <div
                  key={n.id}
                  className={`notif-row ${n.is_read ? 'read' : 'unread'}`}
                  onClick={() => !n.is_read && handleMarkRead(n.id)}
                >
                  <span>{n.type === 'alert' ? '⚠️' : n.type === 'warning' ? '🔔' : 'ℹ️'}</span>
                  <div className="txn-info">
                    <span className="txn-desc">{n.message}</span>
                    <span className="txn-date">{n.created_at}</span>
                  </div>
                  {!n.is_read && <span className="unread-dot" />}
                </div>
              ))
            )}
          </div>

          {/* Backup & Export */}
          <div className="section-box" style={boxStyle}>
            <h3 style={{ marginBottom: 8, flexShrink: 0 }}>💾 Backup & Export</h3>
            <p style={{ color: '#7B78A0', marginBottom: 16, fontSize: 13 }}>
              Download all your data as a JSON file.
            </p>
            <button className="btn-primary" onClick={() => window.location.href = '/reports'}>
              Go to Reports & Export
            </button>
          </div>

        </div>
      </main>
    </div>
  )
}
