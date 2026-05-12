import { useState, useEffect } from 'react'
import { Tag, LogIn, LogOut, CheckCircle } from 'lucide-react'

export default function KrogerAuth({ sessionId, onStatusChange }) {
  const [connected, setConnected] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    checkStatus()
  }, [sessionId])

  async function checkStatus() {
    try {
      const res = await fetch(`/api/kroger/status?session_id=${sessionId}`)
      const data = await res.json()
      setConnected(data.connected)
      onStatusChange(data.connected)
    } catch {
      // silently ignore — Kroger may not be configured
    }
  }

  async function handleConnect() {
    setLoading(true)
    try {
      const res = await fetch(`/api/kroger/login?session_id=${sessionId}`)
      const data = await res.json()
      if (data.auth_url) {
        window.location.href = data.auth_url
      }
    } catch {
      setLoading(false)
    }
  }

  async function handleDisconnect() {
    setLoading(true)
    try {
      await fetch(`/api/kroger/logout?session_id=${sessionId}`, { method: 'POST' })
      setConnected(false)
      onStatusChange(false)
    } finally {
      setLoading(false)
    }
  }

  if (connected) {
    return (
      <div className="flex items-center gap-3 px-4 py-2.5 bg-green-50 border border-green-200 rounded-xl">
        <CheckCircle size={16} className="text-green-600 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-green-800">Kroger Account Connected</div>
          <div className="text-xs text-green-600">Digital coupons included in deal prices</div>
        </div>
        <button
          onClick={handleDisconnect}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs text-green-700 hover:text-red-600 transition-colors"
        >
          <LogOut size={13} />
          Disconnect
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl">
      <Tag size={16} className="text-amber-600 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-amber-800">Connect Kroger Account</div>
        <div className="text-xs text-amber-600">Sign in to include your clipped digital coupons</div>
      </div>
      <button
        onClick={handleConnect}
        disabled={loading}
        className="flex items-center gap-1.5 btn-primary text-xs py-1.5 px-3"
      >
        <LogIn size={13} />
        {loading ? 'Redirecting...' : 'Sign In'}
      </button>
    </div>
  )
}
