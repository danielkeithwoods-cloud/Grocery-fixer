import { useState } from 'react'
import { ShoppingBasket, Sparkles, AlertCircle } from 'lucide-react'
import StoreSelector from './components/StoreSelector'
import PreferencesForm from './components/PreferencesForm'
import DealsPanel from './components/DealsPanel'
import RecipePlan from './components/RecipePlan'
import GroceryList from './components/GroceryList'
import { api } from './services/api'

const DEFAULT_PREFS = {
  num_people: 4,
  num_days: 7,
  macro_profile: 'balanced',
  meat_preference: 'any',
  budget_per_person_per_day: 8,
  meals_per_day: 3,
}

const STEPS = ['store', 'preferences', 'plan']

export default function App() {
  const [step, setStep] = useState('store') // store | preferences | plan
  const [selectedStore, setSelectedStore] = useState(null)
  const [prefs, setPrefs] = useState(DEFAULT_PREFS)

  const [deals, setDeals] = useState([])
  const [dealsLoading, setDealsLoading] = useState(false)
  const [dealsDemoMode, setDealsDemoMode] = useState(false)

  const [plan, setPlan] = useState(null)
  const [planLoading, setPlanLoading] = useState(false)
  const [planError, setPlanError] = useState(null)

  async function handleStoreSelected(store) {
    setSelectedStore(store)
    setDeals([])
    setPlan(null)
    setPlanError(null)
    setDealsLoading(true)
    try {
      const res = await api.fetchDeals(store.id)
      setDeals(res.deals)
      setDealsDemoMode(res.demo_mode)
    } catch (e) {
      console.error('Failed to load deals:', e)
    } finally {
      setDealsLoading(false)
    }
    setStep('preferences')
  }

  async function handleRefreshDeals() {
    if (!selectedStore) return
    setDealsLoading(true)
    try {
      const res = await api.fetchDeals(selectedStore.id)
      setDeals(res.deals)
    } catch (e) {
      console.error(e)
    } finally {
      setDealsLoading(false)
    }
  }

  async function handleGeneratePlan() {
    if (!selectedStore) return
    setPlan(null)
    setPlanError(null)
    setPlanLoading(true)
    setStep('plan')
    try {
      const result = await api.generatePlan({ store_id: selectedStore.id, ...prefs })
      setPlan(result)
    } catch (e) {
      setPlanError(e.message)
    } finally {
      setPlanLoading(false)
    }
  }

  const stepIndex = STEPS.indexOf(step)

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <ShoppingBasket size={24} className="text-green-600" />
            <div>
              <h1 className="text-lg font-bold text-gray-900 leading-tight">Grocery Recipe Optimizer</h1>
              <p className="text-xs text-gray-500 hidden sm:block">Scan deals · Build recipes · Minimize costs</p>
            </div>
          </div>
          {selectedStore && (
            <div className="text-xs text-gray-500 bg-gray-100 px-3 py-1 rounded-full hidden sm:block">
              {selectedStore.name}
            </div>
          )}
        </div>

        {/* Progress steps */}
        <div className="max-w-5xl mx-auto px-4 pb-3 flex items-center gap-2">
          {[
            { key: 'store', label: '1. Choose Store' },
            { key: 'preferences', label: '2. Set Preferences' },
            { key: 'plan', label: '3. Get Recipes' },
          ].map((s, i) => (
            <div key={s.key} className="flex items-center gap-2">
              {i > 0 && <div className={`h-px w-8 ${stepIndex >= i ? 'bg-green-400' : 'bg-gray-200'}`} />}
              <button
                onClick={() => stepIndex >= i && setStep(s.key)}
                className={`text-xs font-medium px-3 py-1 rounded-full transition-all ${
                  step === s.key
                    ? 'bg-green-600 text-white'
                    : stepIndex > i
                    ? 'bg-green-100 text-green-700 hover:bg-green-200'
                    : 'bg-gray-100 text-gray-400 cursor-default'
                }`}
              >
                {s.label}
              </button>
            </div>
          ))}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-5">
        {/* Step 1: Store */}
        {step === 'store' && (
          <StoreSelector onStoreSelected={handleStoreSelected} />
        )}

        {/* Step 2: Preferences + Deals */}
        {step === 'preferences' && (
          <>
            <PreferencesForm prefs={prefs} onChange={setPrefs} />

            <DealsPanel
              deals={deals}
              loading={dealsLoading}
              onRefresh={handleRefreshDeals}
              demoMode={dealsDemoMode}
            />

            <div className="flex justify-between items-center">
              <button className="btn-secondary" onClick={() => setStep('store')}>
                ← Change Store
              </button>
              <button
                className="btn-primary flex items-center gap-2 px-6 py-3 text-base"
                onClick={handleGeneratePlan}
                disabled={planLoading}
              >
                <Sparkles size={18} />
                Generate My Meal Plan
              </button>
            </div>
          </>
        )}

        {/* Step 3: Plan */}
        {step === 'plan' && (
          <>
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
                <button className="btn-secondary mt-4" onClick={handleGeneratePlan}>
                  Try Again
                </button>
              </div>
            )}

            {plan && !planLoading && (
              <>
                <RecipePlan plan={plan} />
                <GroceryList groceryList={plan.grocery_list} />
              </>
            )}

            <div className="flex justify-between">
              <button className="btn-secondary" onClick={() => setStep('preferences')}>
                ← Adjust Preferences
              </button>
              {plan && (
                <button
                  className="btn-primary flex items-center gap-2"
                  onClick={handleGeneratePlan}
                >
                  <Sparkles size={16} />
                  Regenerate Plan
                </button>
              )}
            </div>
          </>
        )}
      </main>

      <footer className="text-center text-xs text-gray-400 py-8">
        Grocery Recipe Optimizer · Powered by Claude AI · Kroger API
      </footer>
    </div>
  )
}
