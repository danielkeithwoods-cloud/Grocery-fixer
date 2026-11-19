import { useState } from 'react'
import { Calendar, Utensils, DollarSign, ShieldAlert, ChevronDown, ChevronUp, Package } from 'lucide-react'
import ChipInput from './ChipInput'
import HouseholdEditor from './HouseholdEditor'

const MACRO_OPTIONS = [
  { value: 'balanced', label: 'Balanced', desc: '30P / 40C / 30F' },
  { value: 'high_protein', label: 'High Protein', desc: '40P / 30C / 30F' },
  { value: 'low_carb', label: 'Low Carb', desc: '35P / 15C / 50F' },
  { value: 'keto', label: 'Keto', desc: '20P / 5C / 75F' },
  { value: 'high_carb', label: 'High Carb', desc: '20P / 55C / 25F' },
]

const MEAT_OPTIONS = [
  { value: 'any', label: 'Any Meat', icon: '🍗' },
  { value: 'chicken', label: 'Chicken', icon: '🐔' },
  { value: 'beef', label: 'Beef', icon: '🥩' },
  { value: 'pork', label: 'Pork', icon: '🐷' },
  { value: 'fish', label: 'Fish/Seafood', icon: '🐟' },
  { value: 'vegetarian', label: 'Vegetarian', icon: '🥗' },
  { value: 'vegan', label: 'Vegan', icon: '🌱' },
]

const MEALS_OPTIONS = [
  { value: 1, label: '1 (Dinner only)' },
  { value: 2, label: '2 (Lunch + Dinner)' },
  { value: 3, label: '3 (All meals)' },
]

const COMMON_ALLERGENS = [
  'Peanuts', 'Tree Nuts', 'Dairy', 'Eggs', 'Gluten', 'Soy', 'Shellfish', 'Fish', 'Sesame', 'Pork',
]

const COMMON_PANTRY = [
  'Salt', 'Pepper', 'Olive oil', 'Rice', 'Pasta', 'Flour', 'Sugar', 'Garlic', 'Onions', 'Soy sauce',
]

export default function PreferencesForm({ prefs, onChange }) {
  const [showDietary, setShowDietary] = useState(
    (prefs.restrictions?.length || 0) + (prefs.dislikes?.length || 0) + (prefs.pantry_items?.length || 0) > 0
  )

  function update(key, value) {
    onChange({ ...prefs, [key]: value })
  }

  function toggleRestriction(item) {
    const current = prefs.restrictions || []
    const exists = current.some(r => r.toLowerCase() === item.toLowerCase())
    update('restrictions', exists ? current.filter(r => r.toLowerCase() !== item.toLowerCase()) : [...current, item])
  }

  const restrictionCount = (prefs.restrictions?.length || 0) + (prefs.dislikes?.length || 0) + (prefs.pantry_items?.length || 0)

  return (
    <div className="card p-6">
      <h2 className="section-title flex items-center gap-2">
        <Utensils size={20} className="text-green-600" />
        Your Preferences
      </h2>

      {/* Household — names + per-person daily calorie targets */}
      <div className="mb-5">
        <HouseholdEditor
          household={prefs.household || []}
          onChange={v => onChange({ ...prefs, household: v, num_people: Math.max(1, v.length) })}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <label className="label flex items-center gap-1.5"><Calendar size={14} /> Number of Days</label>
          <input type="number" min={1} max={14} className="input" value={prefs.num_days}
            onChange={e => update('num_days', parseInt(e.target.value) || 1)} />
        </div>
        <div>
          <label className="label flex items-center gap-1.5"><DollarSign size={14} /> Budget / Person / Day ($)</label>
          <input type="number" min={1} max={50} step={0.5} className="input" value={prefs.budget_per_person_per_day}
            onChange={e => update('budget_per_person_per_day', parseFloat(e.target.value) || 5)} />
        </div>
        <div>
          <label className="label flex items-center gap-1.5"><Utensils size={14} /> Meals Per Day</label>
          <select className="input" value={prefs.meals_per_day}
            onChange={e => update('meals_per_day', parseInt(e.target.value))}>
            {MEALS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      {/* Macro Profile */}
      <div className="mt-5">
        <label className="label">Macro Profile</label>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {MACRO_OPTIONS.map(o => (
            <button key={o.value} type="button" onClick={() => update('macro_profile', o.value)}
              className={`px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                prefs.macro_profile === o.value
                  ? 'border-green-500 bg-green-50 text-green-700 ring-1 ring-green-500'
                  : 'border-gray-200 hover:border-green-300 text-gray-600'
              }`}>
              <div>{o.label}</div>
              <div className="text-xs opacity-70">{o.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Meat Preference */}
      <div className="mt-5">
        <label className="label">Meat / Protein Preference</label>
        <div className="grid grid-cols-3 sm:grid-cols-7 gap-2">
          {MEAT_OPTIONS.map(o => (
            <button key={o.value} type="button" onClick={() => update('meat_preference', o.value)}
              className={`px-2 py-2 rounded-lg border text-sm transition-all ${
                prefs.meat_preference === o.value
                  ? 'border-green-500 bg-green-50 text-green-700 ring-1 ring-green-500'
                  : 'border-gray-200 hover:border-green-300 text-gray-600'
              }`}>
              <div className="text-lg">{o.icon}</div>
              <div className="text-xs font-medium">{o.label}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Dietary restrictions & pantry (collapsible) */}
      <div className="mt-5 border-t border-gray-100 pt-4">
        <button
          type="button"
          onClick={() => setShowDietary(s => !s)}
          className="flex items-center justify-between w-full text-left"
        >
          <span className="flex items-center gap-2 text-sm font-semibold text-gray-700">
            <ShieldAlert size={15} className="text-amber-500" />
            Allergies, Dislikes & Pantry
            {restrictionCount > 0 && (
              <span className="bg-green-100 text-green-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                {restrictionCount}
              </span>
            )}
          </span>
          {showDietary ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
        </button>

        {showDietary && (
          <div className="mt-4 space-y-5">
            {/* Allergies */}
            <div>
              <label className="label">Allergies / Must Avoid</label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {COMMON_ALLERGENS.map(a => {
                  const active = (prefs.restrictions || []).some(r => r.toLowerCase() === a.toLowerCase())
                  return (
                    <button key={a} type="button" onClick={() => toggleRestriction(a)}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                        active
                          ? 'bg-red-50 border-red-300 text-red-700 ring-1 ring-red-300'
                          : 'bg-white border-gray-200 text-gray-600 hover:border-red-200'
                      }`}>
                      {a}
                    </button>
                  )
                })}
              </div>
              <ChipInput
                value={prefs.restrictions || []}
                onChange={v => update('restrictions', v)}
                placeholder="Add another allergy and press Enter"
                tone="red"
              />
              <p className="text-xs text-amber-600 mt-1.5">
                Meal plans are AI-generated — always check product labels yourself before eating.
              </p>
            </div>

            {/* Dislikes */}
            <div>
              <label className="label">Disliked Ingredients</label>
              <ChipInput
                value={prefs.dislikes || []}
                onChange={v => update('dislikes', v)}
                placeholder="e.g. mushrooms, cilantro — press Enter"
                suggestions={['Mushrooms', 'Cilantro', 'Olives', 'Bell peppers', 'Tofu']}
              />
            </div>

            {/* Pantry */}
            <div>
              <label className="label flex items-center gap-1.5">
                <Package size={14} /> Already In My Pantry
              </label>
              <ChipInput
                value={prefs.pantry_items || []}
                onChange={v => update('pantry_items', v)}
                placeholder="Things you already own — kept off the shopping list"
                suggestions={COMMON_PANTRY}
                tone="blue"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
