// Safe localStorage wrapper. Every read and write is guarded: storage can be
// unavailable (private mode, blocked site data) or hold stale/corrupt JSON.

const PREFIX = 'gfx:'

export const KEYS = {
  prefs: 'prefs',
  plan: 'plan',
  snackCart: 'snackCart',
  checked: 'checkedItems',
  store: 'selectedStore',
  recentStores: 'recentStores',
  activeTab: 'activeTab',
}

export function load(key, fallback = null) {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    if (raw === null) return fallback
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

export function save(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value))
  } catch {
    // Quota exceeded or storage blocked — non-fatal.
  }
}

export function remove(key) {
  try {
    localStorage.removeItem(PREFIX + key)
  } catch {
    /* no-op */
  }
}

// The Kroger session id predates this module and is stored as a raw string, so
// keep its original key to avoid dropping an existing account connection.
export function getSessionId() {
  try {
    let id = localStorage.getItem('kroger_session_id')
    if (!id) {
      id = crypto.randomUUID()
      localStorage.setItem('kroger_session_id', id)
    }
    return id
  } catch {
    return crypto.randomUUID()
  }
}

// Check-offs are tied to a specific grocery list; a new plan should start fresh.
export function signatureOf(groceryList = []) {
  return groceryList.map(i => i.item).join('|').slice(0, 500)
}

export function loadChecked(signature) {
  const stored = load(KEYS.checked)
  if (!stored || stored.signature !== signature) return new Set()
  return new Set(stored.items || [])
}

export function saveChecked(signature, checkedSet) {
  save(KEYS.checked, { signature, items: Array.from(checkedSet) })
}

export function rememberStore(store) {
  const recent = load(KEYS.recentStores, [])
  const deduped = [store, ...recent.filter(s => s.id !== store.id)].slice(0, 5)
  save(KEYS.recentStores, deduped)
}
