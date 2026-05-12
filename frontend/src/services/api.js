const BASE = '/api'

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || 'Request failed')
  }
  return res.json()
}

export const api = {
  findStores: (zipCode, radiusMiles = 10) =>
    post('/stores', { zip_code: zipCode, radius_miles: radiusMiles }),

  fetchDeals: (storeId, sessionId = null, limit = 50) =>
    post('/deals', { store_id: storeId, limit, session_id: sessionId }),

  generatePlan: (params) => post('/generate-plan', params),
}
