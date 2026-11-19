import { useState, useEffect } from 'react'
import { ShoppingBasket, Lock, AlertCircle } from 'lucide-react'
import { api, setAccessCode, UnauthorizedError } from '../services/api'

/**
 * Gates the app behind the deployment's access code.
 *
 * When the backend has no APP_ACCESS_CODE set (the local dev case), the check
 * passes immediately and this renders children without ever showing a prompt.
 */
export default function AccessGate({ children }) {
  const [state, setState] = useState('checking') // checking | locked | open | offline
  const [code, setCode] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    check()
  }, [])

  async function check() {
    try {
      await api.authCheck()
      setState('open')
    } catch (e) {
      if (e instanceof UnauthorizedError) {
        setState('locked')
      } else {
        // Backend unreachable (offline, cold start). Let the app load — saved
        // plans and the shopping list still work without the network.
        setState('offline')
      }
    }
  }

  async function submit(e) {
    e.preventDefault()
    if (!code.trim()) return
    setSubmitting(true)
    setError(null)
    setAccessCode(code.trim())
    try {
      await api.authCheck()
      setState('open')
    } catch (err) {
      setAccessCode('')
      setError(err instanceof UnauthorizedError ? 'That code was not accepted.' : err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (state === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" />
      </div>
    )
  }

  if (state === 'locked') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-gray-50 px-4">
        <form onSubmit={submit} className="card p-6 w-full max-w-sm">
          <div className="flex items-center gap-2.5 mb-1">
            <ShoppingBasket size={24} className="text-green-600" />
            <h1 className="text-lg font-bold text-gray-900">Grocery Recipe Optimizer</h1>
          </div>
          <p className="text-sm text-gray-500 mb-5">
            This app is private. Enter the access code to continue.
          </p>

          <label className="label flex items-center gap-1.5">
            <Lock size={14} /> Access Code
          </label>
          <input
            className="input"
            type="password"
            autoFocus
            autoComplete="current-password"
            value={code}
            onChange={e => setCode(e.target.value)}
            placeholder="Enter your access code"
          />

          {error && (
            <div className="flex items-start gap-2 text-sm text-red-600 mt-3">
              <AlertCircle size={15} className="mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          <button type="submit" className="btn-primary w-full mt-4 py-2.5" disabled={submitting}>
            {submitting ? 'Checking...' : 'Unlock'}
          </button>
        </form>
      </div>
    )
  }

  return children
}
