import { useState } from 'react'
import Sidebar from '../components/Sidebar'
import { getReport, exportJSON } from '../api'

export default function Reports() {
  const now = new Date()
  const [startDate, setStartDate] = useState(
    new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  )
  const [endDate, setEndDate] = useState(
    new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]
  )
  const [report, setReport] = useState(null)

  async function generateReport() {
    if (!startDate || !endDate) { alert('Select both dates'); return }
    const data = await getReport(startDate, endDate)
    if (data) setReport(data)
  }

  async function handleExport() {
    const data = await exportJSON()
    if (!data) return
    // Create a downloadable JSON file in the browser
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `money-backup-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="layout">
      <Sidebar />
      <main className="main-content">
        <div className="topbar"><h1>Reports</h1></div>

        <div className="section-box">
          <div className="form-row">
            <div className="form-group">
              <label>From Date</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div className="form-group">
              <label>To Date</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
            <div className="form-group" style={{ alignSelf: 'flex-end' }}>
              <button className="btn-primary" onClick={generateReport}>Generate Report</button>
            </div>
            <div className="form-group" style={{ alignSelf: 'flex-end' }}>
              <button className="btn-secondary" onClick={handleExport}>⬇️ Export JSON</button>
            </div>
          </div>
        </div>

        {report && (
          <>
            <div className="cards-row">
              <div className="card card-income">
                <div className="card-icon">📥</div>
                <div>
                  <div className="card-label">Total Income</div>
                  <div className="card-value">₹{report.total_income.toLocaleString()}</div>
                </div>
              </div>
              <div className="card card-expense">
                <div className="card-icon">📤</div>
                <div>
                  <div className="card-label">Total Expense</div>
                  <div className="card-value">₹{report.total_expense.toLocaleString()}</div>
                </div>
              </div>
              <div className="card card-balance">
                <div className="card-icon">💰</div>
                <div>
                  <div className="card-label">Net Savings</div>
                  <div className="card-value">₹{report.net.toLocaleString()}</div>
                </div>
              </div>
              <div className="card">
                <div className="card-icon">🔢</div>
                <div>
                  <div className="card-label">Transactions</div>
                  <div className="card-value">{report.transaction_count}</div>
                </div>
              </div>
            </div>

            <div className="section-box">
              <h3>Transaction Details</h3>
              <table className="report-table">
                <thead>
                  <tr>
                    <th>Date</th><th>Description</th><th>Category</th><th>Type</th><th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {report.transactions.map((t, i) => (
                    <tr key={i}>
                      <td>{t.date}</td>
                      <td>{t.description || '—'}</td>
                      <td>{t.category}</td>
                      <td className={t.type}>{t.type}</td>
                      <td className={t.type}>
                        {t.type === 'income' ? '+' : '-'}₹{t.amount.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
