// In dev, Vite proxies /api to the backend. For a deployed build (e.g. the app
// on your phone talking to a hosted backend), set VITE_API_BASE to the full
// backend URL, like https://grocery-fixer-api.onrender.com/api
const BASE = import.meta.env.VITE_API_BASE || '/api'

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, options)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || 'Request failed')
  }
  return res.json()
}

const post = (path, body) =>
  request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

const get = (path) => request(path)

const qs = (params) =>
  Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&')

export const api = {
  findStores: (zipCode, radiusMiles = 10) =>
    post('/stores', { zip_code: zipCode, radius_miles: radiusMiles }),

  fetchDeals: (storeId, sessionId = null, limit = 120) =>
    post('/deals', { store_id: storeId, limit, session_id: sessionId }),

  generatePlan: (params) => post('/generate-plan', params),

  swapMeal: (params) => post('/swap-meal', params),

  buildSnackCart: (params) => post('/snack-cart', params),

  krogerStatus: (sessionId) => get(`/kroger/status?${qs({ session_id: sessionId })}`),

  krogerLoginUrl: (sessionId) => get(`/kroger/login?${qs({ session_id: sessionId })}`),

  krogerLogout: (sessionId) =>
    request(`/kroger/logout?${qs({ session_id: sessionId })}`, { method: 'POST' }),
}
