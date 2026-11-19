import { useState } from 'react'
import { X, Plus } from 'lucide-react'

export default function ChipInput({ value = [], onChange, placeholder, suggestions = [], tone = 'gray' }) {
  const [draft, setDraft] = useState('')

  const tones = {
    gray: 'bg-gray-100 text-gray-700',
    red: 'bg-red-50 text-red-700 border border-red-200',
    blue: 'bg-blue-50 text-blue-700 border border-blue-200',
  }

  function add(text) {
    const t = (text || '').trim().replace(/,$/, '')
    if (!t) return
    if (!value.some(v => v.toLowerCase() === t.toLowerCase())) onChange([...value, t])
    setDraft('')
  }

  function removeAt(i) {
    onChange(value.filter((_, idx) => idx !== i))
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      add(draft)
    } else if (e.key === 'Backspace' && !draft && value.length) {
      removeAt(value.length - 1)
    }
  }

  const unusedSuggestions = suggestions.filter(
    s => !value.some(v => v.toLowerCase() === s.toLowerCase())
  )

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5 border border-gray-200 rounded-lg px-2 py-2 focus-within:ring-2 focus-within:ring-green-500 focus-within:border-transparent">
        {value.map((chip, i) => (
          <span key={i} className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${tones[tone]}`}>
            {chip}
            <button type="button" onClick={() => removeAt(i)} className="hover:text-red-600" aria-label={`Remove ${chip}`}>
              <X size={11} />
            </button>
          </span>
        ))}
        <input
          className="flex-1 min-w-[8rem] text-sm outline-none bg-transparent py-0.5"
          placeholder={value.length ? '' : placeholder}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => add(draft)}
        />
      </div>

      {unusedSuggestions.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {unusedSuggestions.map(s => (
            <button
              key={s}
              type="button"
              onClick={() => add(s)}
              className="inline-flex items-center gap-0.5 text-xs text-gray-500 hover:text-green-700 bg-gray-50 hover:bg-green-50 px-2 py-0.5 rounded-full transition-colors"
            >
              <Plus size={10} />{s}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
