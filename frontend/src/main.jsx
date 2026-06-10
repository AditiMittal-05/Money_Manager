import React from 'react'
import ReactDOM from 'react-dom/client'
import { GoogleOAuthProvider } from '@react-oauth/google'
import App from './App'
import './style.css'   // global CSS applied to every page
import { loadLiveRates } from './utils/currency'

// Apply saved theme before React renders to avoid flash
document.documentElement.dataset.theme = localStorage.getItem('theme') || 'dark'

// Fetch live currency rates from backend on startup (cached 24h, auto-refreshes)
loadLiveRates()

// Your Google Client ID (same value used in backend/main.py)
const GOOGLE_CLIENT_ID = "495333564636-4gegah5dbg0b4hoovct7ai6d4rfceg5n.apps.googleusercontent.com"

// GoogleOAuthProvider makes the Google login button available to any component
// inside the app. It must wrap the entire <App />.
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <App />
    </GoogleOAuthProvider>
  </React.StrictMode>
)
