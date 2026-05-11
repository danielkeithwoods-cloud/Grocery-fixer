import { Users, Calendar, Utensils, Beef, DollarSign } from 'lucide-react'

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

export default function PreferencesForm({ prefs, onChange }) {
  function update(key, value) {
    onChange({ ...prefs, [key]: value })
  }

  return (
    <div className="card p-6">
      <h2 className="section-title flex items-center gap-2">
        <Utensils size={20} className="text-green-600" />
        Your Preferences
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {/* People */}
        <div>
          <label className="label flex items-center gap-1.5">
            <Users size={14} /> Number of People
          </label>
          <input
            type="number"
            min={1}
            max={20}
            className="input"
            value={prefs.num_people}
            onChange={e => update('num_people', parseInt(e.target.value) || 1)}
          />
        </div>

        {/* Days */}
        <div>
          <label className="label flex items-center gap-1.5">
            <Calendar size={14} /> Number of Days
          </label>
          <input
            type="number"
            min={1}
            max={14}
            className="input"
            value={prefs.num_days}
            onChange={e => update('num_days', parseInt(e.target.value) || 1)}
          />
        </div>

        {/* Budget */}
        <div>
          <label className="label flex items-center gap-1.5">
            <DollarSign size={14} /> Budget / Person / Day ($)
          </label>
          <input
            type="number"
            min={1}
            max={50}
            step={0.5}
            className="input"
            value={prefs.budget_per_person_per_day}
            onChange={e => update('budget_per_person_per_day', parseFloat(e.target.value) || 5)}
          />
        </div>

        {/* Meals per day */}
        <div>
          <label className="label flex items-center gap-1.5">
            <Utensils size={14} /> Meals Per Day
          </label>
          <select
            className="input"
            value={prefs.meals_per_day}
            onChange={e => update('meals_per_day', parseInt(e.target.value))}
          >
            {MEALS_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Macro Profile */}
      <div className="mt-5">
        <label className="label">Macro Profile</label>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {MACRO_OPTIONS.map(o => (
            <button
              key={o.value}
              type="button"
              onClick={() => update('macro_profile', o.value)}
              className={`px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                prefs.macro_profile === o.value
                  ? 'border-green-500 bg-green-50 text-green-700 ring-1 ring-green-500'
                  : 'border-gray-200 hover:border-green-300 text-gray-600'
              }`}
            >
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
            <button
              key={o.value}
              type="button"
              onClick={() => update('meat_preference', o.value)}
              className={`px-2 py-2 rounded-lg border text-sm transition-all ${
                prefs.meat_preference === o.value
                  ? 'border-green-500 bg-green-50 text-green-700 ring-1 ring-green-500'
                  : 'border-gray-200 hover:border-green-300 text-gray-600'
              }`}
            >
              <div className="text-lg">{o.icon}</div>
              <div className="text-xs font-medium">{o.label}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
