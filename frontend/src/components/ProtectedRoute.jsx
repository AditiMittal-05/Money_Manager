import { Navigate } from 'react-router-dom'
import { getToken } from '../api'

// ProtectedRoute — wraps pages that require login.
// If the user has no token (not logged in), redirect them to the login page.
// Usage in App.jsx:  <ProtectedRoute><Dashboard /></ProtectedRoute>
export default function ProtectedRoute({ children }) {
  const token = getToken()

  if (!token) {
    // No token = not logged in → send to login page
    return <Navigate to="/" replace />
  }

  // Token exists → render the actual page
  return children
}
