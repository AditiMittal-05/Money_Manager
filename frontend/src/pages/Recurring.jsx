import { useState, useEffect } from 'react'
import Sidebar from '../components/Sidebar'
import Modal from '../components/Modal'
import { getRecurring, createRecurring, deleteRecurring, toggleRecurring, getCategories, getAccounts } from '../api'

export default function Recurring() {
  const [items, setItems] = useState([])
  const [categories, setCategories] = useState([])
  const [accounts, setAccounts] = useState([])
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({
    description: '', transaction_type: 'expense', amount: '',
    category_id: '', account_id: '', frequency: 'monthly',
    next_date: new Date().toISOString().split('T')[0]
  })

  useEffect(() => {
    load()
    loadFormData()
  }, [])

  async function load() {
    const data = await getRecurring()
    if (data) setItems(data)
  }

  async function loadFormData() {
    const [cats, accs] = await Promise.all([getCategories(), getAccounts()])
    if (cats) setCategories(cats)
    if (accs) {
      setAccounts(accs)
      if (accs.length > 0) setForm(f => ({ ...f, account_id: accs[0].id }))
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const fd = new FormData()
    Object.entries(form).forEach(([k, v]) => fd.append(k, v))
    await createRecurring(fd)
    setModalOpen(false)
    load()
  }

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div className="layout">
      <Sidebar />
      <main className="main-content">
        <div className="topbar">
          <h1>Recurring Payments</h1>
          <button className="btn-primary" onClick={() => setModalOpen(true)}>+ Add Recurring</button>
        </div>
        <p style={{ color: '#64748B', marginBottom: 16 }}>
          Set up payments that repeat automatically — rent, subscriptions, salary, etc.
        </p>

        <div className="section-box">
          {items.length === 0 ? (
            <p className="empty-msg">No recurring payments set up yet.</p>
          ) : (
            items.map(r => (
              <div className={`txn-row ${r.is_active ? '' : 'dimmed'}`} key={r.id}>
                <span className="txn-icon">{r.type === 'income' ? '📥' : '📤'}</span>
                <div className="txn-info">
                  <span className="txn-desc">{r.description}</span>
                  <span className="txn-date">{r.frequency} · Next: {r.next_date}</span>
                </div>
                <span className={`txn-amount ${r.type}`}>
                  {r.type === 'income' ? '+' : '-'}₹{r.amount.toLocaleString()}
                </span>
                <button className="btn-toggle" onClick={async () => { await toggleRecurring(r.id); load() }}>
                  {r.is_active ? '⏸ Pause' : '▶ Resume'}
                </button>
                <button className="btn-delete" onClick={async () => {
                  if (!confirm('Delete?')) return
                  await deleteRecurring(r.id)
                  load()
                }}>🗑</button>
              </div>
            ))
          )}
        </div>

        <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add Recurring Payment">
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Description</label>
              <input type="text" placeholder="e.g. Netflix, Rent, Salary" required
                value={form.description} onChange={e => setField('description', e.target.value)} />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Type</label>
                <select value={form.transaction_type} onChange={e => setField('transaction_type', e.target.value)}>
                  <option value="expense">Expense</option>
                  <option value="income">Income</option>
                </select>
              </div>
              <div className="form-group">
                <label>Amount (₹)</label>
                <input type="number" step="0.01" required
                  value={form.amount} onChange={e => setField('amount', e.target.value)} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Category</label>
                <select required value={form.category_id} onChange={e => setField('category_id', e.target.value)}>
                  <option value="">Select</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Account</label>
                <select value={form.account_id} onChange={e => setField('account_id', e.target.value)}>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Frequency</label>
                <select value={form.frequency} onChange={e => setField('frequency', e.target.value)}>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>
              <div className="form-group">
                <label>Next Date</label>
                <input type="date" required value={form.next_date} onChange={e => setField('next_date', e.target.value)} />
              </div>
            </div>
            <button type="submit" className="btn-primary full-width">Save</button>
          </form>
        </Modal>
      </main>
    </div>
  )
}
