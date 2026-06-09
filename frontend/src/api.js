// ══════════════════════════════════════════════════════
// api.js — ALL backend calls live here
// Every page imports from this file instead of writing
// fetch() calls directly. This way if the URL changes,
// you only update it in ONE place.
// ══════════════════════════════════════════════════════

export const API_BASE = "http://127.0.0.1:8000";  // use IP directly — localhost can resolve to IPv6 on Windows

// Read the JWT token from localStorage (saved at login)
export function getToken() {
  return localStorage.getItem("token");
}

// Save token + username after login/register
export function saveAuth(token, username) {
  localStorage.setItem("token", token);
  localStorage.setItem("username", username);
}

// Clear auth data on logout
export function clearAuth() {
  localStorage.removeItem("token");
  localStorage.removeItem("username");
}

// ── MAIN FETCH HELPER ──────────────────────────────────
// Every API call goes through this function.
// It automatically adds the Authorization header with your JWT token.
// If the server returns 401 (token expired), it logs you out.
// If the backend is offline, returns null instead of crashing.
export async function apiFetch(path, options = {}) {
  try {
    const token = getToken();
    const res = await fetch(API_BASE + path, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(options.headers || {})
      }
    });

    if (res.status === 401) {
      clearAuth();
      window.location.href = "/";
      return null;
    }
    return res.json();
  } catch {
    // Backend is not running or network error
    return null;
  }
}

// ── AUTH API ───────────────────────────────────────────

/**
 * Google OAuth login.
 * Send the Google credential (ID token) to our backend.
 * The backend verifies it with Google and returns our own JWT.
 * @param {string} credential - the token string from GoogleLogin's onSuccess
 */
export async function googleAuth(credential) {
  try {
    const formData = new FormData()
    formData.append("credential", credential)
    const res = await fetch(`${API_BASE}/auth/google`, {
      method: "POST",
      body: formData
    })
    return { ok: res.ok, data: await res.json() }
  } catch {
    return { ok: false, data: { detail: "Cannot connect to server. Make sure the backend is running." } }
  }
}

export async function loginUser(username, password) {
  try {
    const formData = new FormData();
    formData.append("username", username);
    formData.append("password", password);
    const res = await fetch(`${API_BASE}/login`, { method: "POST", body: formData });
    return { ok: res.ok, data: await res.json() };
  } catch {
    return { ok: false, data: { detail: "Cannot connect to server. Make sure the backend is running." } };
  }
}

export async function registerUser(username, email, password) {
  try {
    const formData = new FormData();
    formData.append("username", username);
    formData.append("email", email);
    formData.append("password", password);
    const res = await fetch(`${API_BASE}/register`, { method: "POST", body: formData });
    return { ok: res.ok, data: await res.json() };
  } catch {
    return { ok: false, data: { detail: "Cannot connect to server. Make sure the backend is running." } };
  }
}

// ── FORGOT / RESET PASSWORD (OTP flow) ───────────────
// Step 1: user enters email → OTP sent to their email
export async function forgotPassword(email) {
  try {
    const fd = new FormData()
    fd.append("email", email)
    const res = await fetch(`${API_BASE}/forgot-password`, { method: "POST", body: fd })
    return { ok: res.ok, data: await res.json() }
  } catch {
    return { ok: false, data: { detail: "Cannot connect to server. Make sure the backend is running." } }
  }
}

// Step 2: user enters email + OTP + new password → password updated
export async function resetPassword(email, otp, newPassword) {
  try {
    const fd = new FormData()
    fd.append("email", email)
    fd.append("otp", otp)
    fd.append("new_password", newPassword)
    const res = await fetch(`${API_BASE}/reset-password`, { method: "POST", body: fd })
    return { ok: res.ok, data: await res.json() }
  } catch {
    return { ok: false, data: { detail: "Cannot connect to server. Make sure the backend is running." } }
  }
}

// ── DASHBOARD ─────────────────────────────────────────
export const getDashboard = () => apiFetch("/dashboard");

// ── ACCOUNTS ──────────────────────────────────────────
export const getAccounts = () => apiFetch("/accounts");
export const deleteAccount = (id) => apiFetch(`/accounts/${id}`, { method: "DELETE" });
export async function createAccount(formData) {
  return apiFetch("/accounts", { method: "POST", body: formData });
}

// ── CATEGORIES ────────────────────────────────────────
export const getCategories = () => apiFetch("/categories");
export const deleteCategory = (id) => apiFetch(`/categories/${id}`, { method: "DELETE" });
export async function createCategory(formData) {
  return apiFetch("/categories", { method: "POST", body: formData });
}

// ── TRANSACTIONS ──────────────────────────────────────
export const getTransactions = (params = "") => apiFetch(`/transactions?limit=100${params}`);
export const deleteTransaction = (id) => apiFetch(`/transactions/${id}`, { method: "DELETE" });
export async function createTransaction(formData) {
  // NOTE: do NOT set Content-Type header — browser sets it automatically for FormData with file
  const token = getToken();
  const res = await fetch(`${API_BASE}/transactions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData
  });
  return { ok: res.ok, data: await res.json() };
}

// ── BUDGETS ───────────────────────────────────────────
export const getBudgets = () => apiFetch("/budgets");
export const deleteBudget = (id) => apiFetch(`/budgets/${id}`, { method: "DELETE" });
export async function createBudget(formData) {
  return apiFetch("/budgets", { method: "POST", body: formData });
}

// ── ANALYTICS ─────────────────────────────────────────
export const getMonthlyAnalytics = (year) => apiFetch(`/analytics/monthly?year=${year}`);
export const getCategoryBreakdown = (type) =>
  apiFetch(`/analytics/category-breakdown?transaction_type=${type}`);

// ── RECURRING ─────────────────────────────────────────
export const getRecurring = () => apiFetch("/recurring");
export const deleteRecurring = (id) => apiFetch(`/recurring/${id}`, { method: "DELETE" });
export const toggleRecurring = (id) => apiFetch(`/recurring/${id}/toggle`, { method: "POST" });
export async function createRecurring(formData) {
  return apiFetch("/recurring", { method: "POST", body: formData });
}

// ── REPORTS ───────────────────────────────────────────
export const getReport = (start, end) =>
  apiFetch(`/reports/summary?start_date=${start}&end_date=${end}`);
export const exportJSON = () => apiFetch("/export/json");

// ── PROFILE & SETTINGS ────────────────────────────────
export const getProfile = () => apiFetch("/me");
export const getNotifications = () => apiFetch("/notifications");
export const markNotifRead = (id) => apiFetch(`/notifications/${id}/read`, { method: "POST" });
export const markAllNotifsRead = () => apiFetch("/notifications/read-all", { method: "POST" });
export async function setPin(pin) {
  const fd = new FormData(); fd.append("pin", pin);
  return apiFetch("/pin/set", { method: "POST", body: fd });
}
export async function verifyPin(pin) {
  const fd = new FormData(); fd.append("pin", pin);
  return apiFetch("/pin/verify", { method: "POST", body: fd });
}
// ── PROFILE (extended) ────────────────────────────────────
export const getProfileStats = () => apiFetch('/profile/stats')

export async function updateProfile(formData) {
  return apiFetch('/profile/update', { method: 'PUT', body: formData })
}

export async function uploadAvatar(formData) {
  try {
    const token = getToken()
    const res = await fetch(`${API_BASE}/profile/avatar`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData
    })
    return { ok: res.ok, data: await res.json() }
  } catch {
    return { ok: false, data: { detail: 'Upload failed' } }
  }
}

export async function deleteAvatar() {
  return apiFetch('/profile/avatar', { method: 'DELETE' })
}

export async function changePassword(formData) {
  try {
    const token = getToken()
    const res = await fetch(`${API_BASE}/profile/change-password`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData
    })
    return await res.json()
  } catch {
    return { detail: 'Request failed' }
  }
}

// Verify reset token
export const verifyResetToken = async (token) => {
  const response = await fetch(`http://127.0.0.1:8000/auth/verify-reset-token/${token}`);

  if (!response.ok) {
    throw new Error('Invalid or expired token');
  }

  return response.json();
};
