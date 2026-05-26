import { useState, useEffect } from 'react'
import Sidebar from '../components/Sidebar'
import Modal from '../components/Modal'
import { getAccounts, createAccount, deleteAccount } from '../api'

export default function Accounts() {
  const [accounts, setAccounts] = useState([])
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({ name: '', account_type: 'bank', balance: 0, color: '#4CAF50' })

  useEffect(() => { load() }, [])

  async function load() {
    const data = await getAccounts()
    if (data) setAccounts(data)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const fd = new FormData()
    Object.entries(form).forEach(([k, v]) => fd.append(k, v))
    await createAccount(fd)
    setModalOpen(false)
    setForm({ name: '', account_type: 'bank', balance: 0, color: '#4CAF50' })
    load()
  }

  async function handleDelete(id) {
    if (!confirm('Delete this account?')) return
    await deleteAccount(id)
    load()
  }

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const typeIcon = { bank: '🏦', cash: '💵', wallet: '📱', credit: '💳' }

  return (
    <div className="layout">
      <Sidebar />
      <main className="main-content">
        <div className="topbar">
          <h1>Accounts & Wallets</h1>
          <button className="btn-primary" onClick={() => setModalOpen(true)}>+ Add Account</button>
        </div>

        <div className="cards-row">
          {accounts.length === 0 ? (
            <p className="empty-msg">No accounts yet.</p>
          ) : (
            accounts.map(a => (
              <div className="card" key={a.id} style={{ borderLeft: `4px solid ${a.color}` }}>
                <div className="card-icon">{typeIcon[a.type] || '🏦'}</div>
                <div style={{ flex: 1 }}>
                  <div className="card-label">{a.name}</div>
                  <div className="card-value">₹{a.balance.toLocaleString()}</div>
                  <div className="card-sub">{a.type} · {a.currency}</div>
                </div>
                <button className="btn-delete" onClick={() => handleDelete(a.id)}>🗑</button>
              </div>
            ))
          )}
        </div>

        <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add Account">
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Account Name</label>
              <input type="text" placeholder="e.g. SBI Savings" required
                value={form.name} onChange={e => setField('name', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Type</label>
              <select value={form.account_type} onChange={e => setField('account_type', e.target.value)}>
                <option value="bank">Bank Account</option>
                <option value="cash">Cash</option>
                <option value="wallet">Digital Wallet</option>
                <option value="credit">Credit Card</option>
              </select>
            </div>
            <div className="form-group">
              <label>Opening Balance (₹)</label>
              <input type="number" step="0.01"
                value={form.balance} onChange={e => setField('balance', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Color</label>
              <input type="color" value={form.color} onChange={e => setField('color', e.target.value)} />
            </div>
            <button type="submit" className="btn-primary full-width">Save Account</button>
          </form>
        </Modal>
      </main>
    </div>
  )
}
