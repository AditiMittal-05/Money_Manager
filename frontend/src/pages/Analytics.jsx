import { useState, useEffect } from 'react'
import { Bar, Doughnut } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement, ArcElement,
  Tooltip, Legend
} from 'chart.js'
import Sidebar from '../components/Sidebar'
import { getMonthlyAnalytics, getCategoryBreakdown } from '../api'

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend)

export default function Analytics() {
  const [year, setYear] = useState(new Date().getFullYear())
  const [monthly, setMonthly] = useState([])
  const [expCat, setExpCat] = useState([])
  const [incCat, setIncCat] = useState([])

  // Reload charts whenever the year dropdown changes
  useEffect(() => { loadCharts() }, [year])

  async function loadCharts() {
    const [mon, exp, inc] = await Promise.all([
      getMonthlyAnalytics(year),
      getCategoryBreakdown('expense'),
      getCategoryBreakdown('income')
    ])
    if (mon) setMonthly(mon)
    if (exp) setExpCat(exp)
    if (inc) setIncCat(inc)
  }

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i)

  const doughnutOpts = {
    responsive: true,
    plugins: { legend: { labels: { color: '#ccc' } } }
  }

  return (
    <div className="layout">
      <Sidebar />
      <main className="main-content">
        <div className="topbar">
          <h1>Analytics</h1>
          <select value={year} onChange={e => setYear(Number(e.target.value))}>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        <div className="charts-row">
          <div className="chart-box full-width">
            <h3>Monthly Income vs Expense — {year}</h3>
            {monthly.length > 0 && (
              <Bar
                data={{
                  labels: monthly.map(m => m.month),
                  datasets: [
                    { label: 'Income ₹', data: monthly.map(m => m.income), backgroundColor: '#4CAF50', borderRadius: 4 },
                    { label: 'Expense ₹', data: monthly.map(m => m.expense), backgroundColor: '#F44336', borderRadius: 4 }
                  ]
                }}
                options={{
                  responsive: true,
                  plugins: { legend: { labels: { color: '#ccc' } } },
                  scales: { x: { ticks: { color: '#ccc' } }, y: { ticks: { color: '#ccc' }, beginAtZero: true } }
                }}
              />
            )}
          </div>
        </div>

        <div className="charts-row">
          <div className="chart-box">
            <h3>Expense by Category (This Month)</h3>
            {expCat.length > 0 ? (
              <Doughnut
                data={{
                  labels: expCat.map(c => `${c.icon} ${c.category}`),
                  datasets: [{ data: expCat.map(c => c.amount), backgroundColor: expCat.map(c => c.color) }]
                }}
                options={doughnutOpts}
              />
            ) : <p className="empty-msg">No expense data this month.</p>}
          </div>
          <div className="chart-box">
            <h3>Income by Category (This Month)</h3>
            {incCat.length > 0 ? (
              <Doughnut
                data={{
                  labels: incCat.map(c => `${c.icon} ${c.category}`),
                  datasets: [{ data: incCat.map(c => c.amount), backgroundColor: incCat.map(c => c.color) }]
                }}
                options={doughnutOpts}
              />
            ) : <p className="empty-msg">No income data this month.</p>}
          </div>
        </div>
      </main>
    </div>
  )
}
