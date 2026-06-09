import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'

// Import all page components (each file = one page/screen)
import Login          from './pages/Login'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword  from './pages/ResetPassword'
import Dashboard    from './pages/Dashboard'
import Transactions from './pages/Transactions'
import Accounts     from './pages/Accounts'
import Categories   from './pages/Categories'
import Budgets      from './pages/Budgets'
import Analytics    from './pages/Analytics'
import Recurring    from './pages/Recurring'
import Reports      from './pages/Reports'
import Settings     from './pages/Settings'
import Profile      from './pages/Profile'
import ProtectedRoute from './components/ProtectedRoute'

// App.jsx is the router — it decides which page to show based on the URL
// e.g. http://localhost:5173/dashboard → shows <Dashboard />
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes — no login required */}
        <Route path="/"                element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password"  element={<ResetPassword />} />

        {/* Protected routes — redirect to "/" if not logged in */}
        <Route path="/dashboard"    element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/transactions" element={<ProtectedRoute><Transactions /></ProtectedRoute>} />
        <Route path="/accounts"     element={<ProtectedRoute><Accounts /></ProtectedRoute>} />
        <Route path="/categories"   element={<ProtectedRoute><Categories /></ProtectedRoute>} />
        <Route path="/budgets"      element={<ProtectedRoute><Budgets /></ProtectedRoute>} />
        <Route path="/analytics"    element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
        <Route path="/recurring"    element={<ProtectedRoute><Recurring /></ProtectedRoute>} />
        <Route path="/reports"      element={<ProtectedRoute><Reports /></ProtectedRoute>} />
        <Route path="/settings"     element={<ProtectedRoute><Settings /></ProtectedRoute>} />
        <Route path="/profile"      element={<ProtectedRoute><Profile /></ProtectedRoute>} />

        {/* Any unknown URL → go to dashboard */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
