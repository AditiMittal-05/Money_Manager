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

  return (
    <div className="layout">
      <Sidebar />
      <main className="main-content">
        <div className="topbar"><h1>Settings</h1></div>

        {/* ── PROFILE ── */}
        <div className="section-box">
          <h3>👤 Profile</h3>
          {profile ? (
            <div className="txn-row" style={{ marginTop: 12 }}>
              <div className="txn-info">
                <span className="txn-desc">👤 {profile.username}</span>
                <span className="txn-date">📧 {profile.email}</span>
              </div>
              <span style={{ color: profile.has_pin ? '#4CAF50' : '#FF9800' }}>
                {profile.has_pin ? '🔐 PIN set' : '⚠️ No PIN set'}
              </span>
            </div>
          ) : <p className="empty-msg">Loading...</p>}
        </div>

        {/* ── SECURITY / PIN ── */}
        <div className="section-box">
          <h3>🔐 Security — PIN Lock</h3>
          <p style={{ color: '#aaa', marginBottom: 16 }}>
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
            <form onSubmit={handleVerifyPin} style={{ marginTop: 16 }}>
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

        {/* ── NOTIFICATIONS ── */}
        <div className="section-box">
          <div className="section-header">
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
                <span className="notif-icon">
                  {n.type === 'alert' ? '⚠️' : n.type === 'warning' ? '🔔' : 'ℹ️'}
                </span>
                <div className="txn-info">
                  <span className="txn-desc">{n.message}</span>
                  <span className="txn-date">{n.created_at}</span>
                </div>
                {!n.is_read && <span className="unread-dot" />}
              </div>
            ))
          )}
        </div>

        {/* ── BACKUP ── */}
        <div className="section-box">
          <h3>💾 Backup & Export</h3>
          <p style={{ color: '#aaa', marginBottom: 16 }}>
            Download all your data as a JSON file.
          </p>
          <button className="btn-primary" onClick={() => window.location.href = '/reports'}>
            Go to Reports & Export
          </button>
        </div>
      </main>
    </div>
  )
}
