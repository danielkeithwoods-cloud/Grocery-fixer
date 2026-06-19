import { useState, useEffect } from 'react'
import { ShoppingBasket, Sparkles, AlertCircle, Tag, ChefHat, Cookie, Store } from 'lucide-react'
import StoreSelector from './components/StoreSelector'
import PreferencesForm from './components/PreferencesForm'
import DealsBrowser from './components/DealsBrowser'
import RecipePlan from './components/RecipePlan'
import GroceryList from './components/GroceryList'
import SnackCartBuilder from './components/SnackCartBuilder'
import KrogerAuth from './components/KrogerAuth'
import { api } from './services/api'

const DEFAULT_PREFS = {
  num_people: 4,
  num_days: 7,
  macro_profile: 'balanced',
  meat_preference: 'any',
  budget_per_person_per_day: 8,
  meals_per_day: 3,
}

function getOrCreateSessionId() {
  let id = localStorage.getItem('kroger_session_id')
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem('kroger_session_id', id)
  }
  return id
}

const TABS = [
  { key: 'deals', label: 'All Deals', icon: Tag },
  { key: 'meals', label: 'Meal Plan', icon: ChefHat },
  { key: 'snacks', label: 'Snack Carts', icon: Cookie },
]

export default function App() {
  const [sessionId] = useState(getOrCreateSessionId)
  const [krogerConnected, setKrogerConnected] = useState(false)

  const [view, setView] = useState('store') // 'store' | 'workspace'
  const [activeTab, setActiveTab] = useState('deals')
  const [selectedStore, setSelectedStore] = useState(null)
  const [prefs, setPrefs] = useState(DEFAULT_PREFS)

  const [deals, setDeals] = useState([])
  const [dealsLoading, setDealsLoading] = useState(false)
  const [dealsDemoMode, setDealsDemoMode] = useState(false)

  const [plan, setPlan] = useState(null)
  const [planLoading, setPlanLoading] = useState(false)
  const [planError, setPlanError] = useState(null)

  // On mount: handle OAuth redirect + restore previously selected store
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    let connected = false
    if (params.get('kroger_connected') === 'true') {
      connected = true
      setKrogerConnected(true)
    }
    if (params.get('kroger_connected') || params.get('kroger_error')) {
      window.history.replaceState({}, '', '/')
    }

    const stored = localStorage.getItem('selected_store')
    if (stored) {
      try {
        const store = JSON.parse(stored)
        setSelectedStore(store)
        setView('workspace')
        loadDeals(store, connected)
      } catch {
        localStorage.removeItem('selected_store')
      }
    }
  }, [])

  async function loadDeals(store, withCoupons = false) {
    setDealsLoading(true)
    try {
      const sid = (krogerConnected || withCoupons) ? sessionId : null
      const res = await api.fetchDeals(store.id, sid)
      setDeals(res.deals)
      setDealsDemoMode(res.demo_mode)
    } catch (e) {
      console.error('Failed to load deals:', e)
    } finally {
      setDealsLoading(false)
    }
  }

  function handleStoreSelected(store) {
    setSelectedStore(store)
    localStorage.setItem('selected_store', JSON.stringify(store))
    setPlan(null)
    setPlanError(null)
    setView('workspace')
    setActiveTab('deals')
    loadDeals(store)
  }

  function handleChangeStore() {
    localStorage.removeItem('selected_store')
    setSelectedStore(null)
    setDeals([])
    setPlan(null)
    setView('store')
  }

  async function handleRefreshDeals() {
    if (selectedStore) await loadDeals(selectedStore)
  }

  async function handleKrogerStatusChange(connected) {
    setKrogerConnected(connected)
    if (selectedStore) await loadDeals(selectedStore, connected)
  }

  async function handleGeneratePlan() {
    if (!selectedStore) return
    setPlan(null)
    setPlanError(null)
    setPlanLoading(true)
    try {
      const result = await api.generatePlan({
        store_id: selectedStore.id,
        session_id: krogerConnected ? sessionId : null,
        ...prefs,
      })
      setPlan(result)
    } catch (e) {
      setPlanError(e.message)
    } finally {
      setPlanLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <ShoppingBasket size={24} className="text-green-600" />
            <div>
              <h1 className="text-lg font-bold text-gray-900 leading-tight">Grocery Recipe Optimizer</h1>
              <p className="text-xs text-gray-500 hidden sm:block">Scan every deal · Build meals & snack carts · Minimize costs</p>
            </div>
          </div>
          {selectedStore && (
            <button
              onClick={handleChangeStore}
              className="flex items-center gap-1.5 text-xs text-gray-500 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-full transition-colors"
            >
              <Store size={13} />
              <span className="hidden sm:inline">{selectedStore.name}</span>
              <span className="text-green-600 font-medium">Change</span>
            </button>
          )}
        </div>

        {/* Tabs (workspace only) */}
        {view === 'workspace' && (
          <div className="max-w-5xl mx-auto px-4 flex items-center gap-1">
            {TABS.map(t => {
              const Icon = t.icon
              return (
                <button
                  key={t.key}
                  onClick={() => setActiveTab(t.key)}
                  className={`flex items-center gap-1.5 text-sm font-medium px-4 py-2.5 border-b-2 transition-all ${
                    activeTab === t.key
                      ? 'border-green-600 text-green-700'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Icon size={15} />
                  {t.label}
                </button>
              )
            })}
          </div>
        )}
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-5">
        {view === 'store' && <StoreSelector onStoreSelected={handleStoreSelected} />}

        {view === 'workspace' && (
          <>
            <KrogerAuth sessionId={sessionId} onStatusChange={handleKrogerStatusChange} />

            {activeTab === 'deals' && (
              <DealsBrowser
                deals={deals}
                loading={dealsLoading}
                onRefresh={handleRefreshDeals}
                demoMode={dealsDemoMode}
                krogerConnected={krogerConnected}
              />
            )}

            {activeTab === 'meals' && (
              <>
                <PreferencesForm prefs={prefs} onChange={setPrefs} />

                <button
                  className="btn-primary flex items-center gap-2 w-full justify-center py-3 text-base"
                  onClick={handleGeneratePlan}
                  disabled={planLoading}
                >
                  <Sparkles size={18} />
                  {planLoading ? 'Building your meal plan...' : 'Generate My Meal Plan'}
                </button>

                {planLoading && (
                  <div className="card p-12 flex flex-col items-center justify-center gap-4">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600" />
                    <div className="text-center">
                      <div className="font-semibold text-gray-800">Building your meal plan...</div>
                      <div className="text-sm text-gray-500 mt-1">Claude is analyzing deals and crafting optimal recipes</div>
                    </div>
                  </div>
                )}

                {planError && (
                  <div className="card p-6">
                    <div className="flex items-start gap-3 text-red-600">
                      <AlertCircle size={20} className="mt-0.5 shrink-0" />
                      <div>
                        <div className="font-semibold mb-1">Failed to generate plan</div>
                        <div className="text-sm text-red-500">{planError}</div>
                      </div>
                    </div>
                  </div>
                )}

                {plan && !planLoading && (
                  <>
                    <RecipePlan plan={plan} />
                    <GroceryList groceryList={plan.grocery_list} />
                  </>
                )}
              </>
            )}

            {activeTab === 'snacks' && (
              <SnackCartBuilder
                storeId={selectedStore.id}
                sessionId={sessionId}
                krogerConnected={krogerConnected}
              />
            )}
          </>
        )}
      </main>

      <footer className="text-center text-xs text-gray-400 py-8">
        Grocery Recipe Optimizer · Powered by Claude AI · Kroger API
      </footer>
    </div>
  )
}
