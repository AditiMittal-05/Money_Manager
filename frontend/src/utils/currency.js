/**
 * currency.js — Live Currency Utility
 * =====================================
 * - Fetches real exchange rates from the backend (which uses frankfurter.app)
 * - Rates auto-refresh every 24 hours
 * - Falls back to hardcoded rates if the backend / internet is offline
 * - fmt(amount) converts any INR amount to the user's preferred currency
 */

import { useEffect, useState } from 'react'
import { API_BASE, getToken } from '../api'

// ── Fallback rates (used only when backend is unreachable) ────────────────
// These are approximate and do NOT auto-update — backend provides live rates
const FALLBACK_RATES = {
  INR: 1,
  USD: 0.012,
  EUR: 0.011,
  GBP: 0.0094,
  AED: 0.044,
  SGD: 0.016,
  JPY: 1.79,
  CAD: 0.016,
  AUD: 0.018,
}

export const SYMBOLS = {
  INR: '₹',
  USD: '$',
  EUR: '€',
  GBP: '£',
  AED: 'د.إ',
  SGD: 'S$',
  JPY: '¥',
  CAD: 'C$',
  AUD: 'A$',
}

// Live rates object — starts with fallback, gets updated when backend responds
export let RATES = { ...FALLBACK_RATES }

// ── Live rate fetching ────────────────────────────────────────────────────

const RATE_CACHE_KEY   = 'live_currency_rates'
const RATE_CACHE_TS    = 'live_currency_rates_ts'
const RATE_CACHE_TTL   = 24 * 60 * 60 * 1000  // 24 hours in ms

/**
 * Load rates from localStorage cache (if fresh) or fetch from backend.
 * Called once on app load, then every 24 hours.
 */
export async function loadLiveRates() {
  // Check localStorage cache first
  try {
    const ts    = parseInt(localStorage.getItem(RATE_CACHE_TS) || '0')
    const saved = localStorage.getItem(RATE_CACHE_KEY)
    if (saved && Date.now() - ts < RATE_CACHE_TTL) {
      const cached = JSON.parse(saved)
      applyRates(cached)
      return cached
    }
  } catch {
    // corrupt cache — fall through to fetch
  }

  // Fetch from backend
  try {
    const token = getToken()
    const res = await fetch(`${API_BASE}/currency/rates`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (!res.ok) throw new Error('backend returned ' + res.status)
    const data = await res.json()

    // Save to localStorage cache
    localStorage.setItem(RATE_CACHE_KEY, JSON.stringify(data.rates))
    localStorage.setItem(RATE_CACHE_TS, Date.now().toString())

    applyRates(data.rates)
    return data
  } catch {
    // Backend offline — stay with fallback rates, no crash
    return null
  }
}

/** Merge fetched rates into the RATES object and notify all components. */
function applyRates(newRates) {
  if (!newRates || typeof newRates !== 'object') return
  Object.assign(RATES, newRates)
  RATES.INR = 1  // base is always 1
  window.dispatchEvent(new Event('currency-change'))
}

// ── Preference helpers ────────────────────────────────────────────────────

/** Read current preference from localStorage (falls back to INR). */
export function getCurrencyCode() {
  return localStorage.getItem('currency_pref') || 'INR'
}

/** Persist preference and notify every component listening. */
export function setCurrencyPref(code) {
  if (!SYMBOLS[code]) return
  localStorage.setItem('currency_pref', code)
  window.dispatchEvent(new Event('currency-change'))
}

// ── Formatting ────────────────────────────────────────────────────────────

/**
 * Format an INR amount in the user's preferred currency.
 * Usage:  fmt(summary.income_this_month)  →  "$147.60" or "₹12,300"
 */
export function fmt(amountInINR) {
  if (amountInINR == null || isNaN(amountInINR)) return '—'
  const code      = getCurrencyCode()
  const rate      = RATES[code] ?? 1
  const sym       = SYMBOLS[code] || code
  const converted = amountInINR * rate

  if (code === 'INR') {
    return `${sym}${Math.round(converted).toLocaleString('en-IN')}`
  }
  if (code === 'JPY') {
    return `${sym}${Math.round(converted).toLocaleString()}`
  }
  return `${sym}${converted.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

// ── React hook ────────────────────────────────────────────────────────────

/**
 * Drop this hook into any component that displays amounts so it re-renders
 * immediately when the user changes currency or live rates are updated.
 *
 *   const currency = useCurrency()   // returns current code, triggers re-render
 */
export function useCurrency() {
  const [code, setCode] = useState(getCurrencyCode)
  useEffect(() => {
    const handler = () => setCode(getCurrencyCode())
    window.addEventListener('currency-change', handler)
    return () => window.removeEventListener('currency-change', handler)
  }, [])
  return code
}
