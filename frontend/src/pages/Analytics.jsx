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

  const chartHeight = 'calc(100vh - 140px)'

  const TICK = '#64748B'
  const GRID = 'rgba(255,255,255,0.05)'

  const BRAND_PALETTE = [
    '#818CF8','#A78BFA','#34D399','#FCD34D',
    '#FB7185','#38BDF8','#86EFAC','#FBBF24',
    '#C084FC','#6EE7B7',
  ]

  const barOpts = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { labels: { color: TICK, boxWidth: 10, font: { size: 11, family: 'Inter' } } } },
    scales: {
      x: { ticks: { color: TICK, font: { size: 10 } }, grid: { color: GRID } },
      y: { ticks: { color: TICK }, beginAtZero: true, grid: { color: GRID } }
    }
  }

  const doughnutOpts = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '68%',
    plugins: {
      legend: {
        position: 'bottom',
        labels: { color: TICK, boxWidth: 10, font: { size: 10, family: 'Inter' }, padding: 10 }
      }
    }
  }

  return (
    <div className="layout">
      <Sidebar />
      <main className="main-content" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div className="topbar">
          <h1>Analytics</h1>
          <select
            value={year}
            onChange={e => setYear(Number(e.target.value))}
            style={{ width: 110, flexShrink: 0 }}
          >
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        {/* All 3 charts in one row, filling remaining screen height */}
        <div style={{ display: 'flex', gap: 16, flex: 1, minHeight: 0 }}>

          {/* Bar chart — wider (takes ~50% width) */}
          <div className="chart-box" style={{ flex: 2, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ marginBottom: 12, fontSize: 14, color: '#6B7280', flexShrink: 0 }}>
              Monthly Income vs Expense — {year}
            </h3>
            <div style={{ flex: 1, minHeight: 0 }}>
              {monthly.length > 0
                ? <Bar data={{
                    labels: monthly.map(m => m.month),
                    datasets: [
                      { label: 'Income ₹',  data: monthly.map(m => m.income),  backgroundColor: '#818CF8', borderRadius: 5, borderSkipped: false },
                      { label: 'Expense ₹', data: monthly.map(m => m.expense), backgroundColor: '#FB7185', borderRadius: 5, borderSkipped: false }
                    ]
                  }} options={barOpts} />
                : <p className="empty-msg">No data for {year}.</p>
              }
            </div>
          </div>

          {/* Expense doughnut */}
          <div className="chart-box" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ marginBottom: 12, fontSize: 14, color: '#6B7280', flexShrink: 0 }}>
              Expense by Category
            </h3>
            <div style={{ flex: 1, minHeight: 0 }}>
              {expCat.length > 0
                ? <Doughnut data={{
                    labels: expCat.map(c => `${c.icon} ${c.category}`),
                    datasets: [{ data: expCat.map(c => c.amount), backgroundColor: expCat.map((_, i) => BRAND_PALETTE[i % BRAND_PALETTE.length]), borderWidth: 2, borderColor: '#fff' }]
                  }} options={doughnutOpts} />
                : <p className="empty-msg">No expense data this month.</p>
              }
            </div>
          </div>

          {/* Income doughnut */}
          <div className="chart-box" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ marginBottom: 12, fontSize: 14, color: '#6B7280', flexShrink: 0 }}>
              Income by Category
            </h3>
            <div style={{ flex: 1, minHeight: 0 }}>
              {incCat.length > 0
                ? <Doughnut data={{
                    labels: incCat.map(c => `${c.icon} ${c.category}`),
                    datasets: [{ data: incCat.map(c => c.amount), backgroundColor: incCat.map((_, i) => BRAND_PALETTE[i % BRAND_PALETTE.length]), borderWidth: 2, borderColor: '#fff' }]
                  }} options={doughnutOpts} />
                : <p className="empty-msg">No income data this month.</p>
              }
            </div>
          </div>

        </div>
      </main>
    </div>
  )
}
