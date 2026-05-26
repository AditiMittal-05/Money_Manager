import { useState, useEffect } from 'react'
import Sidebar from '../components/Sidebar'
import Modal from '../components/Modal'
import { getTransactions, getCategories, getAccounts, createTransaction, deleteTransaction, API_BASE, getToken } from '../api'

export default function Transactions() {
  const [transactions, setTransactions] = useState([])
  const [categories, setCategories] = useState([])
  const [accounts, setAccounts] = useState([])
  const [modalOpen, setModalOpen] = useState(false)

  // Filter state — what user picks in the filter bar
  const [filterType, setFilterType] = useState('')
  const [filterCat, setFilterCat] = useState('')

  // Form state — what user types in the Add Transaction modal
  const [form, setForm] = useState({
    amount: '', transaction_type: 'expense', description: '',
    date: new Date().toISOString().split('T')[0],
    category_id: '', account_id: ''
  })
  const [receiptFile, setReceiptFile] = useState(null)

  useEffect(() => {
    loadCategories()
    loadAccounts()
  }, [])

  // Reload transactions whenever filters change
  useEffect(() => {
    loadTransactions()
  }, [filterType, filterCat])

  async function loadTransactions() {
    let params = ''
    if (filterType) params += `&transaction_type=${filterType}`
    if (filterCat)  params += `&category_id=${filterCat}`
    const data = await getTransactions(params)
    if (data) setTransactions(data)
  }

  async function loadCategories() {
    const data = await getCategories()
    if (data) setCategories(data)
  }

  async function loadAccounts() {
    const data = await getAccounts()
    if (data) {
      setAccounts(data)
      if (data.length > 0) setForm(f => ({ ...f, account_id: data[0].id }))
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const formData = new FormData()
    Object.entries(form).forEach(([k, v]) => formData.append(k, v))
    if (receiptFile) formData.append('receipt', receiptFile)

    const { ok, data } = await createTransaction(formData)
    if (ok) {
      setModalOpen(false)
      loadTransactions()
      setReceiptFile(null)
    } else {
      alert(data.detail || 'Error saving transaction')
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this transaction?')) return
    await deleteTransaction(id)
    loadTransactions()
  }

  // Helper: update one field of the form object without replacing the rest
  const setField = (key, val) => setForm(f => ({ ...f, [key]: val }))

  return (
    <div className="layout">
      <Sidebar />
      <main className="main-content">
        <div className="topbar">
          <h1>Transactions</h1>
          <button className="btn-primary" onClick={() => setModalOpen(true)}>
            + Add Transaction
          </button>
        </div>

        {/* Filters */}
        <div className="filter-bar">
          <select value={filterType} onChange={e => setFilterType(e.target.value)}>
            <option value="">All Types</option>
            <option value="income">Income</option>
            <option value="expense">Expense</option>
          </select>
          <select value={filterCat} onChange={e => setFilterCat(e.target.value)}>
            <option value="">All Categories</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
          </select>
        </div>

        {/* Transaction list */}
        <div className="section-box">
          {transactions.length === 0 ? (
            <p className="empty-msg">No transactions found.</p>
          ) : (
            transactions.map(t => (
              <div className="txn-row" key={t.id}>
                <span className="txn-icon" style={{ background: t.category_color }}>
                  {t.category_icon}
                </span>
                <div className="txn-info">
                  <span className="txn-desc">{t.description || t.category}</span>
                  <span className="txn-date">{t.category} · {t.account} · {t.date}</span>
                </div>
                {t.receipt_image && (
                  <a
                    href={`${API_BASE}/data/uploads/${t.receipt_image}`}
                    target="_blank"
                    rel="noreferrer"
                    className="receipt-link"
                  >🧾</a>
                )}
                <span className={`txn-amount ${t.type}`}>
                  {t.type === 'income' ? '+' : '-'}₹{t.amount.toLocaleString()}
                </span>
                <button className="btn-delete" onClick={() => handleDelete(t.id)}>🗑</button>
              </div>
            ))
          )}
        </div>

        {/* Add Transaction Modal */}
        <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add Transaction">
          <form onSubmit={handleSubmit}>
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
                <input type="number" step="0.01" min="0.01" required
                  value={form.amount} onChange={e => setField('amount', e.target.value)} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Category</label>
                <select required value={form.category_id} onChange={e => setField('category_id', e.target.value)}>
                  <option value="">Select category</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Account</label>
                <select required value={form.account_id} onChange={e => setField('account_id', e.target.value)}>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.name} (₹{a.balance})</option>)}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label>Description</label>
              <input type="text" placeholder="What was this for?"
                value={form.description} onChange={e => setField('description', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Date</label>
              <input type="date" required value={form.date} onChange={e => setField('date', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Receipt Image (optional)</label>
              {/* File inputs work differently — we get the File object from e.target.files */}
              <input type="file" accept="image/*" onChange={e => setReceiptFile(e.target.files[0])} />
            </div>
            <button type="submit" className="btn-primary full-width">Save Transaction</button>
          </form>
        </Modal>
      </main>
    </div>
  )
}
