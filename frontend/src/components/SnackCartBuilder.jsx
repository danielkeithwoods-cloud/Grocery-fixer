import { useState } from 'react'
import { Cookie, Sparkles, AlertCircle, Flame, Dumbbell, Zap, Candy, ShoppingCart, Download } from 'lucide-react'
import { api } from '../services/api'

const FOCUS_PRESETS = [
  { value: 'high_protein', label: 'High Protein', icon: '💪', desc: '10g+ protein/serving' },
  { value: 'low_carb', label: 'Low Carb', icon: '🥑', desc: '<10g carbs/serving' },
  { value: 'low_sugar', label: 'Low Sugar', icon: '🚫🍬', desc: 'Minimal added sugar' },
  { value: 'low_calorie', label: 'Low Calorie', icon: '🪶', desc: '<150 cal/serving' },
  { value: 'high_energy', label: 'High Energy', icon: '⚡', desc: 'Carb-forward fuel' },
  { value: 'balanced', label: 'Balanced', icon: '⚖️', desc: 'Whole-food mix' },
  { value: 'custom', label: 'Custom', icon: '🎯', desc: 'Set exact targets' },
]

export default function SnackCartBuilder({ storeId, sessionId, krogerConnected }) {
  const [focus, setFocus] = useState('high_protein')
  const [budget, setBudget] = useState(20)
  const [snacksPerDay, setSnacksPerDay] = useState(2)
  const [numDays, setNumDays] = useState(7)
  const [custom, setCustom] = useState({ protein_g: '', max_carbs_g: '', max_calories: '', max_fat_g: '', max_sugar_g: '' })

  const [cart, setCart] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleBuild() {
    setLoading(true)
    setError(null)
    setCart(null)
    try {
      const params = {
        store_id: storeId,
        macro_focus: focus,
        budget: Number(budget),
        snacks_per_day: Number(snacksPerDay),
        num_days: Number(numDays),
        session_id: krogerConnected ? sessionId : null,
      }
      if (focus === 'custom') {
        const ct = {}
        if (custom.protein_g) ct.protein_g = Number(custom.protein_g)
        if (custom.max_carbs_g) ct.max_carbs_g = Number(custom.max_carbs_g)
        if (custom.max_calories) ct.max_calories = Number(custom.max_calories)
        if (custom.max_fat_g) ct.max_fat_g = Number(custom.max_fat_g)
        if (custom.max_sugar_g) ct.max_sugar_g = Number(custom.max_sugar_g)
        params.custom_targets = ct
      }
      const result = await api.buildSnackCart(params)
      setCart(result)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="card p-6">
        <h2 className="section-title flex items-center gap-2">
          <Cookie size={20} className="text-green-600" />
          Build a Snack Cart
        </h2>
        <p className="text-sm text-gray-500 -mt-2 mb-4">
          Pick a macro goal and we'll assemble a cost-optimized snack cart from current deals.
        </p>

        {/* Focus presets */}
        <label className="label">Macro Goal</label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
          {FOCUS_PRESETS.map(p => (
            <button
              key={p.value}
              type="button"
              onClick={() => setFocus(p.value)}
              className={`px-3 py-2.5 rounded-lg border text-sm transition-all text-left ${
                focus === p.value
                  ? 'border-green-500 bg-green-50 ring-1 ring-green-500'
                  : 'border-gray-200 hover:border-green-300'
              }`}
            >
              <div className="text-lg leading-none mb-1">{p.icon}</div>
              <div className="font-semibold text-gray-800">{p.label}</div>
              <div className="text-xs text-gray-500">{p.desc}</div>
            </button>
          ))}
        </div>

        {/* Custom targets */}
        {focus === 'custom' && (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-4">
            <div className="text-sm font-semibold text-gray-700 mb-3">Per-Serving Targets (leave blank to ignore)</div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <CustomField label="Min Protein (g)" value={custom.protein_g} onChange={v => setCustom({ ...custom, protein_g: v })} />
              <CustomField label="Max Carbs (g)" value={custom.max_carbs_g} onChange={v => setCustom({ ...custom, max_carbs_g: v })} />
              <CustomField label="Max Calories" value={custom.max_calories} onChange={v => setCustom({ ...custom, max_calories: v })} />
              <CustomField label="Max Fat (g)" value={custom.max_fat_g} onChange={v => setCustom({ ...custom, max_fat_g: v })} />
              <CustomField label="Max Sugar (g)" value={custom.max_sugar_g} onChange={v => setCustom({ ...custom, max_sugar_g: v })} />
            </div>
          </div>
        )}

        {/* Quantities */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="label">Budget ($)</label>
            <input type="number" min={2} step={1} className="input" value={budget} onChange={e => setBudget(e.target.value)} />
          </div>
          <div>
            <label className="label">Snacks Per Day</label>
            <input type="number" min={1} max={6} className="input" value={snacksPerDay} onChange={e => setSnacksPerDay(e.target.value)} />
          </div>
          <div>
            <label className="label">Number of Days</label>
            <input type="number" min={1} max={30} className="input" value={numDays} onChange={e => setNumDays(e.target.value)} />
          </div>
        </div>

        <button
          className="btn-primary flex items-center gap-2 mt-5 w-full justify-center py-3 text-base"
          onClick={handleBuild}
          disabled={loading}
        >
          <Sparkles size={18} />
          {loading ? 'Building cart...' : 'Build My Snack Cart'}
        </button>
      </div>

      {loading && (
        <div className="card p-12 flex flex-col items-center justify-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600" />
          <div className="text-sm text-gray-500">Matching snacks to your macro goal...</div>
        </div>
      )}

      {error && (
        <div className="card p-6">
          <div className="flex items-start gap-3 text-red-600">
            <AlertCircle size={20} className="mt-0.5 shrink-0" />
            <div>
              <div className="font-semibold mb-1">Couldn't build the cart</div>
              <div className="text-sm text-red-500">{error}</div>
            </div>
          </div>
        </div>
      )}

      {cart && !loading && <SnackCartResult cart={cart} />}
    </div>
  )
}

function CustomField({ label, value, onChange }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      <input type="number" min={0} className="input" value={value} onChange={e => onChange(e.target.value)} />
    </div>
  )
}

function SnackCartResult({ cart }) {
  const { snack_cart = [], summary = {} } = cart
  const avg = summary.avg_macros_per_serving || {}

  function downloadCart() {
    const lines = ['SNACK CART', '==========', '']
    for (const it of snack_cart) {
      lines.push(`□ ${it.quantity}x ${it.item}${it.brand ? ' (' + it.brand + ')' : ''} — ${it.size} — $${(it.total_cost || 0).toFixed(2)}`)
      const m = it.macros_per_serving || {}
      lines.push(`    per serving: ${m.calories || 0} cal, ${m.protein_g || 0}p / ${m.carbs_g || 0}c / ${m.fat_g || 0}f`)
    }
    lines.push('', `TOTAL: $${(summary.total_cost || 0).toFixed(2)} for ${summary.total_servings || 0} servings`)
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'snack-cart.txt'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="section-title flex items-center gap-2 mb-0">
          <ShoppingCart size={20} className="text-green-600" /> Your Snack Cart
        </h2>
        <button onClick={downloadCart} className="btn-secondary flex items-center gap-1.5 text-sm py-1.5">
          <Download size={14} /> Download
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <SummaryCard value={`$${(summary.total_cost || 0).toFixed(2)}`} label="Total Cost" sub={`of $${(summary.budget || 0).toFixed(0)} budget`} color="green" />
        <SummaryCard value={summary.total_servings || 0} label="Servings" sub={`$${(summary.cost_per_serving || 0).toFixed(2)} each`} color="blue" />
        <SummaryCard value={`${avg.protein_g || 0}g`} label="Avg Protein" sub="per serving" color="purple" />
        <SummaryCard value={avg.calories || 0} label="Avg Calories" sub="per serving" color="orange" />
      </div>

      {summary.target_match_notes && (
        <div className="text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 mb-5">
          {summary.target_match_notes}
        </div>
      )}

      {/* Items */}
      <div className="space-y-2 mb-5">
        {snack_cart.map((it, i) => {
          const m = it.macros_per_serving || {}
          return (
            <div key={i} className="border border-gray-200 rounded-xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-800">{it.quantity}× {it.item}</span>
                    {it.on_sale && <span className="badge-sale">On Sale</span>}
                  </div>
                  <div className="text-xs text-gray-500">{it.brand ? it.brand + ' · ' : ''}{it.size} · {it.servings} servings</div>
                  {it.why && <div className="text-sm text-gray-600 mt-1">{it.why}</div>}
                </div>
                <div className="text-right shrink-0">
                  <div className="font-bold text-green-700">${(it.total_cost || 0).toFixed(2)}</div>
                  <div className="text-xs text-gray-400">${(it.unit_price || 0).toFixed(2)} ea</div>
                </div>
              </div>
              <div className="flex gap-4 mt-2 text-xs">
                <span className="flex items-center gap-1 text-orange-600"><Flame size={12} /> {m.calories || 0} cal</span>
                <span className="flex items-center gap-1 text-blue-600"><Dumbbell size={12} /> {m.protein_g || 0}g P</span>
                <span className="flex items-center gap-1 text-amber-600"><Zap size={12} /> {m.carbs_g || 0}g C</span>
                <span className="flex items-center gap-1 text-gray-500">{m.fat_g || 0}g F</span>
                {m.sugar_g != null && <span className="flex items-center gap-1 text-pink-600"><Candy size={12} /> {m.sugar_g}g sugar</span>}
              </div>
            </div>
          )
        })}
      </div>

      {summary.tips?.length > 0 && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-blue-800 mb-2">Tips</h3>
          <ul className="space-y-1">
            {summary.tips.map((t, i) => (
              <li key={i} className="text-sm text-blue-700 flex gap-2"><span>💡</span>{t}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function SummaryCard({ value, label, sub, color }) {
  const colors = {
    green: 'bg-green-50 text-green-700',
    blue: 'bg-blue-50 text-blue-700',
    purple: 'bg-purple-50 text-purple-700',
    orange: 'bg-orange-50 text-orange-700',
  }
  return (
    <div className={`rounded-xl p-3 ${colors[color]}`}>
      <div className="text-xl font-bold">{value}</div>
      <div className="text-xs font-medium opacity-80">{label}</div>
      <div className="text-xs opacity-60">{sub}</div>
    </div>
  )
}
