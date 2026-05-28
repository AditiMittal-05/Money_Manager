import { useState, useEffect } from 'react'
import { Bar, Doughnut } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement, ArcElement,
  Tooltip, Legend
} from 'chart.js'
import Sidebar from '../components/Sidebar'
import { getDashboard, getMonthlyAnalytics, getCategoryBreakdown } from '../api'

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend)

export default function Dashboard() {
  const [summary, setSummary] = useState(null)
  const [monthly, setMonthly] = useState([])
  const [catData, setCatData] = useState([])

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    const year = new Date().getFullYear()
    const [dash, mon, cat] = await Promise.all([
      getDashboard(),
      getMonthlyAnalytics(year),
      getCategoryBreakdown('expense')
    ])
    if (dash) setSummary(dash)
    if (mon)  setMonthly(mon)
    if (cat)  setCatData(cat)
  }

  const barOpts = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { labels: { color: '#ccc', boxWidth: 12 } } },
    scales: { x: { ticks: { color: '#ccc', font: { size: 10 } } }, y: { ticks: { color: '#ccc' }, beginAtZero: true } }
  }

  const doughnutOpts = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom', labels: { color: '#ccc', boxWidth: 10, font: { size: 10 } } } }
  }

  return (
    <div className="layout">
      <Sidebar />

      <main className="main-content" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

        {/* Top bar */}
        <div className="topbar" style={{ flexShrink: 0 }}>
          <h1>Dashboard</h1>
          <div className="topbar-right">
            <span className="notif-icon">
              🔔 <span className="badge">{summary?.unread_notifications || 0}</span>
            </span>
            <span>Hello, {localStorage.getItem('username')}!</span>
          </div>
        </div>

        {/* Summary cards */}
        <div className="cards-row" style={{ flexShrink: 0 }}>
          {summary ? (
            <>
              <div className="card card-income">
                <div className="card-icon">📥</div>
                <div>
                  <div className="card-label">Income This Month</div>
                  <div className="card-value">₹{summary.income_this_month.toLocaleString()}</div>
                </div>
              </div>
              <div className="card card-expense">
                <div className="card-icon">📤</div>
                <div>
                  <div className="card-label">Expense This Month</div>
                  <div className="card-value">₹{summary.expense_this_month.toLocaleString()}</div>
                </div>
              </div>
              <div className="card card-balance">
                <div className="card-icon">💰</div>
                <div>
                  <div className="card-label">Net This Month</div>
                  <div className="card-value">₹{summary.balance_this_month.toLocaleString()}</div>
                </div>
              </div>
              <div className="card card-total">
                <div className="card-icon">🏦</div>
                <div>
                  <div className="card-label">Total Balance</div>
                  <div className="card-value">₹{summary.total_balance.toLocaleString()}</div>
                </div>
              </div>
            </>
          ) : <p className="empty-msg">Loading...</p>}
        </div>

        {/* Charts + Recent Transactions — fills remaining height */}
        <div style={{ display: 'flex', gap: 16, flex: 1, minHeight: 0 , alignItems:'stretch' }}>

          {/* Bar chart */}
          <div className="chart-box" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' , height: '350px'}}>
            <h3 style={{ flexShrink: 0, marginBottom: 8, fontSize: 14, color: '#aaa' }}>Monthly Income vs Expense</h3>
            <div style={{ flex: 1, minHeight: 0 }}>
              {monthly.length > 0 && (
                <Bar
                  data={{
                    labels: monthly.map(m => m.month),
                    datasets: [
                      { label: 'Income', data: monthly.map(m => m.income), backgroundColor: '#4CAF50' },
                      { label: 'Expense', data: monthly.map(m => m.expense), backgroundColor: '#F44336' }
                    ]
                  }}
                  options={barOpts}
                />
              )}
            </div>
          </div>

          {/* Doughnut chart */}
          <div className="chart-box" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' , overflow: 'hidden' , height: '350px'}}>
            <h3 style={{ flexShrink: 0, marginBottom: 8, fontSize: 14, color: '#aaa' }}>Spending by Category</h3>
            <div style={{ flex: 1, minHeight: 0 }}>
              {catData.length > 0 && (
                <Doughnut
                  data={{
                    labels: catData.map(c => c.category),
                    datasets: [{ data: catData.map(c => c.amount), backgroundColor: catData.map(c => c.color) }]
                  }}
                  options={doughnutOpts}
                />
              )}
            </div>
          </div>

          {/* Recent Transactions — scrolls internally */}
          <div className="section-box" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0 , height: '350px'}}>
            <div className="section-header" style={{ flexShrink: 0 }}>
              <h3>Recent Transactions</h3>
              <a href="/transactions" className="link-all">View all →</a>
            </div>
            <div style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
              {!summary ? null : summary.recent_transactions.length === 0 ? (
                <p className="empty-msg">No transactions yet.</p>
              ) : (
                summary.recent_transactions.map(t => (
                  <div className="txn-row" key={t.id}>
                    <span className="txn-icon">{t.icon}</span>
                    <div className="txn-info">
                      <span className="txn-desc">{t.description || t.category}</span>
                      <span className="txn-date">{t.date}</span>
                    </div>
                    <span className={`txn-amount ${t.type}`}>
                      {t.type === 'income' ? '+' : '-'}₹{t.amount.toLocaleString()}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      </main>
    </div>
  )
}
