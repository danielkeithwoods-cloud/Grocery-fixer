import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import AccessGate from './components/AccessGate'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AccessGate>
      <App />
    </AccessGate>
  </React.StrictMode>
)

// Register the service worker in production only — in dev it would shadow HMR.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Offline support is optional; a failed registration shouldn't break the app.
    })
  })
}
