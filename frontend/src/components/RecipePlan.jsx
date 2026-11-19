import { useState } from 'react'
import { ChefHat, Clock, Users, ChevronDown, ChevronUp, Flame, Dumbbell, Zap, RefreshCw, Printer } from 'lucide-react'

const MEAL_ICONS = { breakfast: '🌅', lunch: '☀️', dinner: '🌙', snack: '🍎' }

function dayTotals(day) {
  const t = { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
  for (const meal of day.meals || []) {
    const m = meal.macros_per_serving || {}
    t.calories += m.calories || 0
    t.protein_g += m.protein_g || 0
    t.carbs_g += m.carbs_g || 0
    t.fat_g += m.fat_g || 0
  }
  return t
}

export default function RecipePlan({ plan, onSwapMeal, swappingKey }) {
  const [expandedMeal, setExpandedMeal] = useState(null)
  const [activeDay, setActiveDay] = useState(0)

  if (!plan) return null

  const { meal_plan, summary } = plan
  const dayIndex = Math.min(activeDay, meal_plan.length - 1)
  const currentDay = meal_plan[dayIndex]
  const totals = dayTotals(currentDay)

  return (
    <div className="card p-6 print-block">
      <div className="flex items-center justify-between mb-4">
        <h2 className="section-title flex items-center gap-2 mb-0">
          <ChefHat size={20} className="text-green-600" />
          Your Meal Plan
        </h2>
        <button onClick={() => window.print()} className="btn-secondary flex items-center gap-1.5 text-sm py-1.5 no-print">
          <Printer size={14} /> Print
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <SummaryCard label="Total Cost" value={`$${(summary.total_estimated_cost ?? 0).toFixed(2)}`}
          sub={`$${(summary.cost_per_person_per_day ?? 0).toFixed(2)}/person/day`} color="green" />
        <SummaryCard label="Avg Daily Calories" value={(summary.average_daily_calories_per_person ?? 0).toLocaleString()}
          sub="per person" color="orange" />
        <SummaryCard label="Deals Savings" value={`$${(summary.total_savings_from_deals ?? 0).toFixed(2)}`}
          sub="vs. regular prices" color="red" />
        <SummaryCard label="Days Planned" value={meal_plan.length}
          sub={`${meal_plan[0]?.meals.length} meals/day`} color="blue" />
      </div>

      {/* Day tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1 mb-4 no-print">
        {meal_plan.map((day, i) => (
          <button key={day.day} onClick={() => { setActiveDay(i); setExpandedMeal(null) }}
            className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
              dayIndex === i ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}>
            Day {day.day}
            <span className="ml-1 text-xs opacity-70">${(day.day_total_cost ?? 0).toFixed(0)}</span>
          </button>
        ))}
      </div>

      {/* Day nutrition rollup (one standard serving at each meal) */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 mb-3 text-sm">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Day {currentDay.day} · 1 serving/meal</span>
        <span className="flex items-center gap-1 text-orange-600"><Flame size={13} /> {totals.calories.toLocaleString()} cal</span>
        <span className="flex items-center gap-1 text-blue-600"><Dumbbell size={13} /> {totals.protein_g}g protein</span>
        <span className="flex items-center gap-1 text-amber-600"><Zap size={13} /> {totals.carbs_g}g carbs</span>
        <span className="text-gray-500">{totals.fat_g}g fat</span>
      </div>

      {/* Per-person calorie targets vs. what the plan delivers */}
      {summary.per_person_daily?.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
          {summary.per_person_daily.map((p, i) => {
            const target = p.target_calories || 0
            const planned = p.planned_calories || 0
            const delta = target ? Math.round(((planned - target) / target) * 100) : 0
            const onTarget = Math.abs(delta) <= 10
            return (
              <div key={i} className="border border-gray-200 rounded-xl px-3 py-2">
                <div className="text-sm font-semibold text-gray-800 truncate">{p.name}</div>
                <div className="text-xs text-gray-500">
                  {planned.toLocaleString()} / {target.toLocaleString()} cal
                </div>
                <div className={`text-xs font-semibold ${onTarget ? 'text-green-600' : 'text-amber-600'}`}>
                  {delta === 0 ? 'on target' : `${delta > 0 ? '+' : ''}${delta}%`}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Meals */}
      <div className="space-y-3">
        {currentDay.meals.map((meal, mi) => {
          const key = `${dayIndex}-${mi}`
          const expanded = expandedMeal === key
          const swapping = swappingKey === key
          return (
            <div key={key} className={`border rounded-xl overflow-hidden transition-opacity ${swapping ? 'opacity-50' : ''} ${expanded ? 'border-green-300' : 'border-gray-200'}`}>
              <div className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                <button className="flex items-center gap-3 flex-1 min-w-0 text-left"
                  onClick={() => setExpandedMeal(expanded ? null : key)}>
                  <span className="text-xl">{MEAL_ICONS[meal.meal_type] || '🍽️'}</span>
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{meal.meal_type}</span>
                    <div className="font-semibold text-gray-800">{meal.name}</div>
                    <div className="text-sm text-gray-500 truncate">{meal.description}</div>
                  </div>
                </button>

                <div className="text-right shrink-0">
                  <div className="font-bold text-green-700">${(meal.estimated_meal_cost ?? 0).toFixed(2)}</div>
                  <div className="text-xs text-gray-400">for {meal.servings}</div>
                </div>

                {onSwapMeal && (
                  <button
                    onClick={() => onSwapMeal(dayIndex, mi)}
                    disabled={swapping}
                    title="Swap this meal for a different recipe"
                    className="no-print shrink-0 flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-green-700 border border-gray-200 hover:border-green-300 rounded-lg px-2 py-1.5 transition-colors disabled:opacity-50"
                  >
                    <RefreshCw size={12} className={swapping ? 'animate-spin' : ''} />
                    {swapping ? 'Swapping' : 'Swap'}
                  </button>
                )}

                <button onClick={() => setExpandedMeal(expanded ? null : key)} className="no-print shrink-0">
                  {expanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                </button>
              </div>

              {expanded && (
                <div className="border-t border-gray-100 px-4 py-4 bg-gray-50/50">
                  <MacroBar macros={meal.macros_per_serving} />

                  <div className="flex gap-4 mt-3 mb-4 text-sm text-gray-500">
                    <span className="flex items-center gap-1"><Clock size={13} /> Prep: {meal.prep_time_minutes}m</span>
                    <span className="flex items-center gap-1"><Clock size={13} /> Cook: {meal.cook_time_minutes}m</span>
                    <span className="flex items-center gap-1"><Users size={13} /> {meal.servings} servings</span>
                  </div>

                  {/* Who gets how much */}
                  {meal.per_person_portions?.length > 0 && (
                    <div className="mb-4">
                      <h4 className="text-sm font-semibold text-gray-700 mb-2">Portions</h4>
                      <div className="flex flex-wrap gap-2">
                        {meal.per_person_portions.map((p, pi) => (
                          <span key={pi} className="inline-flex items-baseline gap-1.5 bg-white border border-gray-200 rounded-lg px-2.5 py-1 text-sm">
                            <span className="font-medium text-gray-800">{p.name}</span>
                            <span className="text-green-700 font-semibold">{p.servings}×</span>
                            {p.calories != null && <span className="text-xs text-gray-400">{p.calories} cal</span>}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <h4 className="text-sm font-semibold text-gray-700 mb-2">Ingredients</h4>
                  <ul className="space-y-1 mb-4">
                    {(meal.ingredients || []).map((ing, ii) => (
                      <li key={ii} className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-1.5">
                          {ing.on_sale && <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" title="On sale" />}
                          <span className="text-gray-700">{ing.item}</span>
                          <span className="text-gray-400">— {ing.amount}</span>
                        </span>
                        <span className="text-gray-500 font-medium">${(ing.estimated_cost ?? 0).toFixed(2)}</span>
                      </li>
                    ))}
                  </ul>

                  <h4 className="text-sm font-semibold text-gray-700 mb-2">Instructions</h4>
                  <ol className="space-y-1">
                    {(meal.instructions || []).map((step, si) => (
                      <li key={si} className="text-sm text-gray-600 flex gap-2">
                        <span className="shrink-0 font-semibold text-green-600">{si + 1}.</span>{step}
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {summary.shopping_tips?.length > 0 && (
        <div className="mt-5 bg-blue-50 border border-blue-100 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-blue-800 mb-2">Shopping Tips</h3>
          <ul className="space-y-1">
            {summary.shopping_tips.map((tip, i) => (
              <li key={i} className="text-sm text-blue-700 flex gap-2"><span>💡</span>{tip}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function SummaryCard({ label, value, sub, color }) {
  const colors = {
    green: 'bg-green-50 text-green-700',
    orange: 'bg-orange-50 text-orange-700',
    red: 'bg-red-50 text-red-700',
    blue: 'bg-blue-50 text-blue-700',
  }
  return (
    <div className={`rounded-xl p-3 ${colors[color]}`}>
      <div className="text-xl font-bold">{value}</div>
      <div className="text-xs opacity-80 font-medium">{label}</div>
      <div className="text-xs opacity-60">{sub}</div>
    </div>
  )
}

function MacroBar({ macros }) {
  if (!macros) return null
  const { calories, protein_g, carbs_g, fat_g } = macros
  const total = protein_g * 4 + carbs_g * 4 + fat_g * 9
  const pPct = total > 0 ? Math.round((protein_g * 4 / total) * 100) : 0
  const cPct = total > 0 ? Math.round((carbs_g * 4 / total) * 100) : 0
  const fPct = Math.max(0, 100 - pPct - cPct)

  return (
    <div>
      <div className="flex items-center gap-4 text-sm mb-1">
        <span className="flex items-center gap-1 text-orange-600"><Flame size={13} /> {calories} cal</span>
        <span className="flex items-center gap-1 text-blue-600"><Dumbbell size={13} /> {protein_g}g protein</span>
        <span className="flex items-center gap-1 text-amber-600"><Zap size={13} /> {carbs_g}g carbs</span>
        <span className="text-gray-500">{fat_g}g fat</span>
      </div>
      <div className="flex h-2 rounded-full overflow-hidden gap-0.5">
        <div className="bg-blue-400 rounded-full" style={{ width: `${pPct}%` }} title={`Protein ${pPct}%`} />
        <div className="bg-amber-400 rounded-full" style={{ width: `${cPct}%` }} title={`Carbs ${cPct}%`} />
        <div className="bg-red-300 rounded-full" style={{ width: `${fPct}%` }} title={`Fat ${fPct}%`} />
      </div>
      <div className="flex gap-3 mt-1 text-xs text-gray-400">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />Protein {pPct}%</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />Carbs {cPct}%</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-300 inline-block" />Fat {fPct}%</span>
      </div>
    </div>
  )
}
