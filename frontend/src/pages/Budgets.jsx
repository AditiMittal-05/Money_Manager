import { useState, useEffect } from 'react'
import Sidebar from '../components/Sidebar'
import Modal from '../components/Modal'
import { getBudgets, createBudget, deleteBudget, getCategories } from '../api'
import { fmt, useCurrency } from '../utils/currency'

export default function Budgets() {
  useCurrency()
  const [budgets, setBudgets] = useState([])
  const [categories, setCategories] = useState([])
  const [modalOpen, setModalOpen] = useState(false)

  const now = new Date()
  const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  const defaultEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]

  const [form, setForm] = useState({
    category_id: '', amount: '', period: 'monthly',
    start_date: defaultStart, end_date: defaultEnd
  })

  useEffect(() => {
    load()
    loadCats()
  }, [])

  async function load() {
    const data = await getBudgets()
    if (data) setBudgets(data)
  }

  async function loadCats() {
    const data = await getCategories()
    if (data) {
      const expense = data.filter(c => c.type === 'expense')
      setCategories(expense)
      if (expense.length > 0) setForm(f => ({ ...f, category_id: expense[0].id }))
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const fd = new FormData()
    Object.entries(form).forEach(([k, v]) => fd.append(k, v))
    await createBudget(fd)
    setModalOpen(false)
    load()
  }

  async function handleDelete(id) {
    if (!confirm('Delete this budget?')) return
    await deleteBudget(id)
    load()
  }

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div className="layout">
      <Sidebar />
      <main className="main-content">
        <div className="topbar">
          <h1>Budgets</h1>
          <button className="btn-primary" onClick={() => setModalOpen(true)}>+ Set Budget</button>
        </div>

        <div className="section-box">
          {budgets.length === 0 ? (
            <p className="empty-msg">No budgets set yet. Create one to track your spending!</p>
          ) : (
            budgets.map(b => {
              const barColor = b.percentage >= 80 ? '#FB7185' : b.percentage >= 60 ? '#FFB800' : '#34D399'
              return (
                <div className="budget-row" key={b.id}>
                  <div className="budget-header">
                    <span>{b.category_icon} {b.category}</span>
                    <span>{fmt(b.spent)} / {fmt(b.budget_amount)}</span>
                    <button className="btn-delete" onClick={() => handleDelete(b.id)}>🗑</button>
                  </div>
                  <div className="progress-bar">
                    <div
                      className="progress-fill"
                      style={{ width: `${Math.min(b.percentage, 100)}%`, background: barColor }}
                    />
                  </div>
                  <div className="budget-footer">
                    <span>{b.percentage}% used</span>
                    <span style={{ color: b.remaining < 0 ? '#FB7185' : '#34D399' }}>
                      {b.remaining >= 0
                        ? `${fmt(b.remaining)} remaining`
                        : `${fmt(Math.abs(b.remaining))} over budget!`}
                    </span>
                  </div>
                </div>
              )
            })
          )}
        </div>

        <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Set Budget">
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Category</label>
              <select required value={form.category_id} onChange={e => setField('category_id', e.target.value)}>
                {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Budget Amount</label>
              <input type="number" min="1" placeholder="e.g. 5000" required
                value={form.amount} onChange={e => setField('amount', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Period</label>
              <select value={form.period} onChange={e => setField('period', e.target.value)}>
                <option value="monthly">Monthly</option>
                <option value="weekly">Weekly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Start Date</label>
                <input type="date" required value={form.start_date} onChange={e => setField('start_date', e.target.value)} />
              </div>
              <div className="form-group">
                <label>End Date</label>
                <input type="date" required value={form.end_date} onChange={e => setField('end_date', e.target.value)} />
              </div>
            </div>
            <button type="submit" className="btn-primary full-width">Save Budget</button>
          </form>
        </Modal>
      </main>
    </div>
  )
}
