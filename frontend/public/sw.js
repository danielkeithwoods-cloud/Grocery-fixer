// Service worker: caches the app shell so the app opens with no signal (useful
// in a store). Saved plans and check-offs already live in localStorage, which
// works offline, so only the shell needs caching.
//
// API responses are deliberately never cached — stale prices would be worse
// than no prices.

const CACHE = 'grocery-fixer-v1'
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png']

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  )
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

function isCacheable(response) {
  return response && response.status === 200 && response.type === 'basic'
}

self.addEventListener('fetch', event => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // Always hit the network for data — never serve stale deals or plans.
  if (url.pathname.startsWith('/api')) return

  // Navigations: network first, fall back to the cached shell when offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (isCacheable(response)) {
            const copy = response.clone()
            caches.open(CACHE).then(c => c.put('/index.html', copy)).catch(() => {})
          }
          return response
        })
        .catch(() => caches.match('/index.html').then(r => r || caches.match('/')))
    )
    return
  }

  // Static assets: serve from cache, revalidating in the background.
  event.respondWith(
    caches.match(request).then(cached => {
      const network = fetch(request)
        .then(response => {
          if (isCacheable(response)) {
            const copy = response.clone()
            caches.open(CACHE).then(c => c.put(request, copy)).catch(() => {})
          }
          return response
        })
        .catch(() => cached)
      return cached || network
    })
  )
})
