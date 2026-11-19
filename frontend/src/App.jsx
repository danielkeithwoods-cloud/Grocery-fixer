import { useState, useEffect, useRef } from 'react'
import { ShoppingBasket, Sparkles, AlertCircle, Tag, ChefHat, Cookie, Store } from 'lucide-react'
import StoreSelector from './components/StoreSelector'
import PreferencesForm from './components/PreferencesForm'
import DealsBrowser from './components/DealsBrowser'
import RecipePlan from './components/RecipePlan'
import GroceryList from './components/GroceryList'
import SnackCartBuilder from './components/SnackCartBuilder'
import KrogerAuth from './components/KrogerAuth'
import { api } from './services/api'
import { load, save, remove, KEYS, getSessionId, rememberStore } from './services/storage'

const DEFAULT_PREFS = {
  num_people: 4,
  num_days: 7,
  macro_profile: 'balanced',
  meat_preference: 'any',
  budget_per_person_per_day: 8,
  meals_per_day: 3,
  restrictions: [],
  dislikes: [],
  pantry_items: [],
  household: [],
}

// Older saved preferences only had a people count — expand it into a household
// list so the calorie-target editor always has rows to show.
function migratePrefs(stored) {
  const merged = { ...DEFAULT_PREFS, ...(stored || {}) }
  if (!Array.isArray(merged.household) || merged.household.length === 0) {
    const n = Math.min(20, Math.max(1, merged.num_people || 1))
    merged.household = Array.from({ length: n }, (_, i) => ({
      name: `Person ${i + 1}`,
      calories_per_day: 2000,
      notes: '',
    }))
  }
  merged.num_people = merged.household.length
  return merged
}

const TABS = [
  { key: 'deals', label: 'All Deals', icon: Tag },
  { key: 'meals', label: 'Meal Plan', icon: ChefHat },
  { key: 'snacks', label: 'Snack Carts', icon: Cookie },
]

export default function App() {
  const [sessionId] = useState(getSessionId)
  const [krogerConnected, setKrogerConnected] = useState(false)

  const [view, setView] = useState('store')
  const [activeTab, setActiveTab] = useState(() => load(KEYS.activeTab, 'deals'))
  const [selectedStore, setSelectedStore] = useState(null)
  const [prefs, setPrefs] = useState(() => migratePrefs(load(KEYS.prefs)))

  const [deals, setDeals] = useState([])
  const [dealsLoading, setDealsLoading] = useState(false)
  const [dealsDemoMode, setDealsDemoMode] = useState(false)

  const [plan, setPlan] = useState(() => load(KEYS.plan))
  const [planLoading, setPlanLoading] = useState(false)
  const [planError, setPlanError] = useState(null)
  const [listStale, setListStale] = useState(false)
  const [swappingKey, setSwappingKey] = useState(null)

  const connectedRef = useRef(false)

  // Persist preferences, plan, and active tab as they change
  useEffect(() => { save(KEYS.prefs, prefs) }, [prefs])
  useEffect(() => { plan ? save(KEYS.plan, plan) : remove(KEYS.plan) }, [plan])
  useEffect(() => { save(KEYS.activeTab, activeTab) }, [activeTab])

  // On mount: handle the Kroger OAuth redirect and restore the last session
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    let connected = false
    if (params.get('kroger_connected') === 'true') {
      connected = true
      connectedRef.current = true
      setKrogerConnected(true)
    }
    if (params.get('kroger_connected') || params.get('kroger_error')) {
      window.history.replaceState({}, '', '/')
    }

    const stored = load(KEYS.store) || load('legacy_selected_store')
    if (stored && stored.id) {
      setSelectedStore(stored)
      setView('workspace')
      loadDeals(stored, connected)
    }
  }, [])

  async function loadDeals(store, withCoupons = false) {
    setDealsLoading(true)
    try {
      const useSession = withCoupons || connectedRef.current
      const res = await api.fetchDeals(store.id, useSession ? sessionId : null)
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
    save(KEYS.store, store)
    rememberStore(store)
    setPlan(null)
    setPlanError(null)
    setListStale(false)
    setView('workspace')
    setActiveTab('deals')
    loadDeals(store)
  }

  function handleChangeStore() {
    remove(KEYS.store)
    setSelectedStore(null)
    setDeals([])
    setView('store')
  }

  async function handleRefreshDeals() {
    if (selectedStore) await loadDeals(selectedStore)
  }

  async function handleKrogerStatusChange(connected) {
    connectedRef.current = connected
    setKrogerConnected(connected)
    if (selectedStore) await loadDeals(selectedStore, connected)
  }

  function dietaryPayload() {
    return {
      restrictions: prefs.restrictions || [],
      dislikes: prefs.dislikes || [],
      pantry_items: prefs.pantry_items || [],
      household: prefs.household || [],
    }
  }

  async function handleGeneratePlan() {
    if (!selectedStore) return
    setPlan(null)
    setPlanError(null)
    setListStale(false)
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

  async function handleSwapMeal(dayIndex, mealIndex) {
    if (!selectedStore || !plan) return
    const key = `${dayIndex}-${mealIndex}`
    setSwappingKey(key)
    setPlanError(null)

    const day = plan.meal_plan[dayIndex]
    const target = day.meals[mealIndex]
    const allNames = plan.meal_plan.flatMap(d => d.meals.map(m => m.name))

    try {
      const replacement = await api.swapMeal({
        store_id: selectedStore.id,
        session_id: krogerConnected ? sessionId : null,
        meal_type: target.meal_type,
        day: day.day,
        num_people: prefs.num_people,
        macro_profile: prefs.macro_profile,
        meat_preference: prefs.meat_preference,
        budget_per_meal:
          (prefs.budget_per_person_per_day * prefs.num_people) / Math.max(1, prefs.meals_per_day),
        meals_per_day: prefs.meals_per_day,
        previous_meal_name: target.name,
        avoid_names: allNames,
        ...dietaryPayload(),
      })

      // Splice in the new meal and keep the cost figures coherent
      setPlan(prev => {
        const next = structuredClone(prev)
        const oldCost = next.meal_plan[dayIndex].meals[mealIndex].estimated_meal_cost || 0
        const newCost = replacement.estimated_meal_cost || 0
        next.meal_plan[dayIndex].meals[mealIndex] = replacement
        next.meal_plan[dayIndex].day_total_cost =
          (next.meal_plan[dayIndex].day_total_cost || 0) - oldCost + newCost

        const days = next.meal_plan.length || 1
        const people = prefs.num_people || 1
        next.summary.total_estimated_cost = (next.summary.total_estimated_cost || 0) - oldCost + newCost
        next.summary.cost_per_person_per_day = next.summary.total_estimated_cost / (days * people)
        return next
      })
      setListStale(true)
    } catch (e) {
      setPlanError(e.message)
    } finally {
      setSwappingKey(null)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <ShoppingBasket size={24} className="text-green-600" />
            <div>
              <h1 className="text-lg font-bold text-gray-900 leading-tight">Grocery Recipe Optimizer</h1>
              <p className="text-xs text-gray-500 hidden sm:block">Scan every deal · Build meals &amp; snack carts · Minimize costs</p>
            </div>
          </div>
          {selectedStore && (
            <button onClick={handleChangeStore}
              className="flex items-center gap-1.5 text-xs text-gray-500 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-full transition-colors">
              <Store size={13} />
              <span className="hidden sm:inline">{selectedStore.name}</span>
              <span className="text-green-600 font-medium">Change</span>
            </button>
          )}
        </div>

        {view === 'workspace' && (
          <div className="max-w-5xl mx-auto px-4 flex items-center gap-1">
            {TABS.map(t => {
              const Icon = t.icon
              return (
                <button key={t.key} onClick={() => setActiveTab(t.key)}
                  className={`flex items-center gap-1.5 text-sm font-medium whitespace-nowrap px-2.5 sm:px-4 py-2.5 border-b-2 transition-all ${
                    activeTab === t.key
                      ? 'border-green-600 text-green-700'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}>
                  <Icon size={15} />
                  {t.label}
                  {t.key === 'meals' && plan && (
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" title="Saved plan" />
                  )}
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
              <DealsBrowser deals={deals} loading={dealsLoading} onRefresh={handleRefreshDeals}
                demoMode={dealsDemoMode} krogerConnected={krogerConnected} />
            )}

            {activeTab === 'meals' && (
              <>
                <PreferencesForm prefs={prefs} onChange={setPrefs} />

                <button className="btn-primary flex items-center gap-2 w-full justify-center py-3 text-base"
                  onClick={handleGeneratePlan} disabled={planLoading}>
                  <Sparkles size={18} />
                  {planLoading ? 'Building your meal plan...' : plan ? 'Regenerate Meal Plan' : 'Generate My Meal Plan'}
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
                        <div className="font-semibold mb-1">Something went wrong</div>
                        <div className="text-sm text-red-500">{planError}</div>
                      </div>
                    </div>
                  </div>
                )}

                {plan && !planLoading && (
                  <>
                    <RecipePlan plan={plan} onSwapMeal={handleSwapMeal} swappingKey={swappingKey} />
                    <GroceryList groceryList={plan.grocery_list} stale={listStale} />
                  </>
                )}
              </>
            )}

            {activeTab === 'snacks' && (
              <SnackCartBuilder
                storeId={selectedStore.id}
                sessionId={sessionId}
                krogerConnected={krogerConnected}
                restrictions={prefs.restrictions || []}
                dislikes={prefs.dislikes || []}
              />
            )}
          </>
        )}
      </main>

      <footer className="text-center text-xs text-gray-400 py-8 no-print">
        Grocery Recipe Optimizer · Powered by Claude · Kroger API
      </footer>
    </div>
  )
}
