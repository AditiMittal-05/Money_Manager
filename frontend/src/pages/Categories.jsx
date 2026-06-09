import { useState, useEffect } from 'react'
import Sidebar from '../components/Sidebar'
import Modal from '../components/Modal'
import { getCategories, createCategory, deleteCategory } from '../api'

export default function Categories() {
  const [categories, setCategories] = useState([])
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({ name: '', category_type: 'expense', icon: '💰', color: '#8B5CF6' })

  useEffect(() => { load() }, [])

  async function load() {
    const data = await getCategories()
    if (data) setCategories(data)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const fd = new FormData()
    Object.entries(form).forEach(([k, v]) => fd.append(k, v))
    await createCategory(fd)
    setModalOpen(false)
    setForm({ name: '', category_type: 'expense', icon: '💰', color: '#8B5CF6' })
    load()
  }

  async function handleDelete(id) {
    if (!confirm('Delete this category?')) return
    await deleteCategory(id)
    load()
  }

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }))

  // Filter by type for the two columns
  const incomeCats  = categories.filter(c => c.type === 'income')
  const expenseCats = categories.filter(c => c.type === 'expense')

  const renderList = (cats) =>
    cats.length === 0 ? <p className="empty-msg">None yet.</p> :
    cats.map(c => (
      <div className="cat-row" key={c.id} style={{ borderLeft: `3px solid ${c.color}` }}>
        <span className="cat-icon">{c.icon}</span>
        <span className="cat-name">{c.name}</span>
        <button className="btn-delete" onClick={() => handleDelete(c.id)}>🗑</button>
      </div>
    ))

  return (
    <div className="layout">
      <Sidebar />
      <main className="main-content">
        <div className="topbar">
          <h1>Categories</h1>
          <button className="btn-primary" onClick={() => setModalOpen(true)}>+ Add Category</button>
        </div>

        <div className="two-col">
          <div className="section-box">
            <h3>💚 Income Categories</h3>
            {renderList(incomeCats)}
          </div>
          <div className="section-box">
            <h3>❤️ Expense Categories</h3>
            {renderList(expenseCats)}
          </div>
        </div>

        <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add Category">
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Name</label>
              <input type="text" placeholder="e.g. Groceries" required
                value={form.name} onChange={e => setField('name', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Type</label>
              <select value={form.category_type} onChange={e => setField('category_type', e.target.value)}>
                <option value="expense">Expense</option>
                <option value="income">Income</option>
              </select>
            </div>
            <div className="form-group">
              <label>Icon (paste an emoji)</label>
              <input type="text" maxLength={2}
                value={form.icon} onChange={e => setField('icon', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Color</label>
              <input type="color" value={form.color} onChange={e => setField('color', e.target.value)} />
            </div>
            <button type="submit" className="btn-primary full-width">Save Category</button>
          </form>
        </Modal>
      </main>
    </div>
  )
}
