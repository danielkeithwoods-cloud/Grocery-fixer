import { Users, Plus, X, Flame } from 'lucide-react'

// Rough daily intake presets (moderately active). Users can type any number.
const PRESETS = [
  { label: 'Adult (M)', calories: 2500 },
  { label: 'Adult (F)', calories: 2000 },
  { label: 'Teen', calories: 2400 },
  { label: 'Child', calories: 1600 },
  { label: 'Toddler', calories: 1200 },
  { label: 'Active / Athlete', calories: 3000 },
]

export function makeMember(name = '', calories = 2000) {
  return { name, calories_per_day: calories, notes: '' }
}

export default function HouseholdEditor({ household = [], onChange }) {
  const total = household.reduce((s, p) => s + (Number(p.calories_per_day) || 0), 0)

  function update(i, patch) {
    onChange(household.map((p, idx) => (idx === i ? { ...p, ...patch } : p)))
  }

  function addMember(calories = 2000, label = '') {
    const fallbackName = label || `Person ${household.length + 1}`
    onChange([...household, makeMember(fallbackName, calories)])
  }

  function removeMember(i) {
    onChange(household.filter((_, idx) => idx !== i))
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="label flex items-center gap-1.5 mb-0">
          <Users size={14} /> Household
          <span className="text-gray-400 font-normal">
            ({household.length} {household.length === 1 ? 'person' : 'people'})
          </span>
        </label>
        {total > 0 && (
          <span className="flex items-center gap-1 text-xs font-semibold text-orange-600">
            <Flame size={12} /> {total.toLocaleString()} cal/day total
          </span>
        )}
      </div>

      <div className="space-y-2">
        {household.map((person, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              className="input flex-1 min-w-0"
              placeholder={`Person ${i + 1}`}
              value={person.name}
              maxLength={40}
              onChange={e => update(i, { name: e.target.value })}
            />
            <div className="relative w-32 shrink-0">
              <input
                type="number"
                min={800}
                max={6000}
                step={50}
                className="input pr-9"
                value={person.calories_per_day}
                onChange={e => update(i, { calories_per_day: parseInt(e.target.value) || 0 })}
              />
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">
                cal
              </span>
            </div>
            <button
              type="button"
              onClick={() => removeMember(i)}
              disabled={household.length <= 1}
              title={household.length <= 1 ? 'At least one person is required' : 'Remove'}
              className="shrink-0 p-2 text-gray-400 hover:text-red-600 disabled:opacity-30 disabled:hover:text-gray-400 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>

      {/* Quick add */}
      <div className="flex flex-wrap gap-1.5 mt-2">
        {PRESETS.map(p => (
          <button
            key={p.label}
            type="button"
            onClick={() => addMember(p.calories, p.label)}
            className="inline-flex items-center gap-1 text-xs text-gray-600 hover:text-green-700 bg-gray-50 hover:bg-green-50 border border-gray-200 hover:border-green-300 px-2.5 py-1 rounded-full transition-colors"
          >
            <Plus size={11} />
            {p.label}
            <span className="text-gray-400">{p.calories.toLocaleString()}</span>
          </button>
        ))}
      </div>

      <p className="text-xs text-gray-500 mt-2">
        Everyone eats the same dishes — portions are sized per person to hit each target.
      </p>
    </div>
  )
}
