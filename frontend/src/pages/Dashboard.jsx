import { useState, useEffect } from 'react'
import { Bar, Doughnut } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement, ArcElement,
  Tooltip, Legend
} from 'chart.js'
import Sidebar from '../components/Sidebar'
import { getDashboard, getMonthlyAnalytics, getCategoryBreakdown } from '../api'

// Register the chart types we use (required by Chart.js v4)
ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend)

// ══════════════════════════════════════════════════════
// Dashboard.jsx
//
// React concepts used here:
//   useEffect → runs code ONCE when the component first appears on screen
//               (equivalent to "onload" in old HTML)
//   useState  → stores the data fetched from the backend
// ══════════════════════════════════════════════════════

export default function Dashboard() {
  // Each useState stores one piece of data
  const [summary, setSummary] = useState(null)
  const [monthly, setMonthly] = useState([])
  const [catData, setCatData] = useState([])

  // useEffect with [] as second arg runs once when this component loads
  useEffect(() => {
    loadAll()
  }, [])

  async function loadAll() {
    const year = new Date().getFullYear()
    // Run all 3 API calls at the same time (parallel) for speed
    const [dash, mon, cat] = await Promise.all([
      getDashboard(),
      getMonthlyAnalytics(year),
      getCategoryBreakdown('expense')
    ])
    if (dash) setSummary(dash)
    if (mon)  setMonthly(mon)
    if (cat)  setCatData(cat)
  }

  const chartOptions = {
    responsive: true,
    plugins: { legend: { labels: { color: '#ccc' } } },
    scales: { x: { ticks: { color: '#ccc' } }, y: { ticks: { color: '#ccc' }, beginAtZero: true } }
  }

  return (
    <div className="layout">
      <Sidebar />   {/* reusable sidebar component */}

      <main className="main-content">
        <div className="topbar">
          <h1>Dashboard</h1>
          <div className="topbar-right">
            <span className="notif-icon">
              🔔 <span className="badge">{summary?.unread_notifications || 0}</span>
            </span>
            <span>Hello, {localStorage.getItem('username')}!</span>
          </div>
        </div>

        {/* Summary cards — show loading skeleton while data loads */}
        {!summary ? (
          <p className="empty-msg">Loading...</p>
        ) : (
          <div className="cards-row">
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
          </div>
        )}

        {/* Charts */}
        <div className="charts-row">
          <div className="chart-box">
            <h3>Monthly Income vs Expense</h3>
            {monthly.length > 0 && (
              <Bar
                data={{
                  labels: monthly.map(m => m.month),
                  datasets: [
                    { label: 'Income', data: monthly.map(m => m.income), backgroundColor: '#4CAF50' },
                    { label: 'Expense', data: monthly.map(m => m.expense), backgroundColor: '#F44336' }
                  ]
                }}
                options={chartOptions}
              />
            )}
          </div>
          <div className="chart-box">
            <h3>Spending by Category</h3>
            {catData.length > 0 && (
              <Doughnut
                data={{
                  labels: catData.map(c => c.category),
                  datasets: [{ data: catData.map(c => c.amount), backgroundColor: catData.map(c => c.color) }]
                }}
                options={{ responsive: true, plugins: { legend: { labels: { color: '#ccc' } } } }}
              />
            )}
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="section-box">
          <div className="section-header">
            <h3>Recent Transactions</h3>
            <a href="/transactions" className="link-all">View all →</a>
          </div>
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
      </main>
    </div>
  )
}
