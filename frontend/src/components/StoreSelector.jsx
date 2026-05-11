import { useState } from 'react'
import { MapPin, Search, Store } from 'lucide-react'
import { api } from '../services/api'

export default function StoreSelector({ onStoreSelected }) {
  const [zipCode, setZipCode] = useState('')
  const [stores, setStores] = useState([])
  const [selectedStore, setSelectedStore] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [demoMode, setDemoMode] = useState(false)

  async function handleSearch(e) {
    e.preventDefault()
    if (!zipCode.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await api.findStores(zipCode.trim())
      setStores(res.stores)
      setDemoMode(res.demo_mode)
      if (res.stores.length === 0) setError('No stores found near that zip code.')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function handleSelect(store) {
    setSelectedStore(store)
    onStoreSelected(store)
  }

  return (
    <div className="card p-6">
      <h2 className="section-title flex items-center gap-2">
        <Store size={20} className="text-green-600" />
        Select Your Store
      </h2>

      <form onSubmit={handleSearch} className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="input pl-9"
            placeholder="Enter zip code (e.g. 43215)"
            value={zipCode}
            onChange={e => setZipCode(e.target.value)}
            maxLength={10}
          />
        </div>
        <button type="submit" className="btn-primary flex items-center gap-2" disabled={loading}>
          <Search size={16} />
          {loading ? 'Searching...' : 'Find Stores'}
        </button>
      </form>

      {demoMode && (
        <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
          Demo mode — showing sample Kroger locations. Add KROGER_CLIENT_ID and KROGER_CLIENT_SECRET to backend/.env for live data.
        </div>
      )}

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">{error}</div>
      )}

      {stores.length > 0 && (
        <div className="space-y-2">
          {stores.map(store => (
            <button
              key={store.id}
              onClick={() => handleSelect(store)}
              className={`w-full text-left px-4 py-3 rounded-lg border transition-all ${
                selectedStore?.id === store.id
                  ? 'border-green-500 bg-green-50 ring-1 ring-green-500'
                  : 'border-gray-200 hover:border-green-300 hover:bg-gray-50'
              }`}
            >
              <div className="font-medium text-gray-800">{store.name}</div>
              <div className="text-sm text-gray-500">{store.address}, {store.city}, {store.state} {store.zip}</div>
            </button>
          ))}
        </div>
      )}

      {selectedStore && (
        <div className="mt-3 text-sm text-green-700 font-medium">
          Selected: {selectedStore.name}
        </div>
      )}
    </div>
  )
}
