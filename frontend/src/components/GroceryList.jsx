import { useState, useEffect, useMemo } from 'react'
import { ShoppingCart, Check, Download, Copy, Printer, Store, RotateCcw } from 'lucide-react'
import { signatureOf, loadChecked, saveChecked } from '../services/storage'

const CATEGORY_ORDER = [
  'Meat & Seafood', 'Produce', 'Dairy & Eggs', 'Grains & Pasta',
  'Canned Goods', 'Oils & Condiments', 'Frozen', 'Bakery', 'Snacks', 'Other',
]

function groupByCategory(items) {
  const groups = {}
  for (const item of items) {
    const cat = item.category || 'Other'
    if (!groups[cat]) groups[cat] = []
    groups[cat].push(item)
  }
  return groups
}

function idFor(item, i) {
  return `${item.item}::${i}`
}

export default function GroceryList({ groceryList, stale = false }) {
  const signature = useMemo(() => signatureOf(groceryList || []), [groceryList])
  const [checked, setChecked] = useState(() => loadChecked(signature))
  const [shopping, setShopping] = useState(false)
  const [copied, setCopied] = useState(false)

  // Reset check state when a different plan's list arrives
  useEffect(() => {
    setChecked(loadChecked(signature))
  }, [signature])

  useEffect(() => {
    saveChecked(signature, checked)
  }, [signature, checked])

  if (!groceryList || groceryList.length === 0) return null

  const indexed = groceryList.map((item, i) => ({ ...item, _id: idFor(item, i) }))
  const groups = groupByCategory(indexed)
  const sortedCats = CATEGORY_ORDER.filter(c => groups[c]).concat(
    Object.keys(groups).filter(c => !CATEGORY_ORDER.includes(c))
  )

  const totalCost = indexed.reduce((s, i) => s + (i.estimated_cost || 0), 0)
  const inCart = indexed.filter(i => checked.has(i._id))
  const inCartCost = inCart.reduce((s, i) => s + (i.estimated_cost || 0), 0)
  const remainingCost = totalCost - inCartCost
  const onSaleCount = indexed.filter(i => i.on_sale).length

  function toggleCheck(id) {
    setChecked(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function asText() {
    const lines = ['GROCERY LIST', '============', '']
    for (const cat of sortedCats) {
      lines.push(cat.toUpperCase())
      for (const item of groups[cat]) {
        const mark = checked.has(item._id) ? '[x]' : '[ ]'
        const sale = item.on_sale ? ` (SALE $${item.sale_price?.toFixed(2)}/${item.unit})` : ''
        lines.push(`  ${mark} ${item.item} — ${item.amount} — $${(item.estimated_cost ?? 0).toFixed(2)}${sale}`)
      }
      lines.push('')
    }
    lines.push(`ESTIMATED TOTAL: $${totalCost.toFixed(2)}`)
    return lines.join('\n')
  }

  function downloadList() {
    const blob = new Blob([asText()], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'grocery-list.txt'
    a.click()
    URL.revokeObjectURL(url)
  }

  async function copyList() {
    try {
      await navigator.clipboard.writeText(asText())
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="card p-6 print-block">
      <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
        <h2 className="section-title flex items-center gap-2 mb-0">
          <ShoppingCart size={20} className="text-green-600" />
          Grocery List
          <span className="text-sm font-normal text-gray-500">({groceryList.length} items)</span>
        </h2>
        <div className="flex gap-2 no-print">
          <button
            onClick={() => setShopping(s => !s)}
            className={`flex items-center gap-1.5 text-sm py-1.5 px-3 rounded-lg font-medium border transition-all ${
              shopping ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
            }`}
          >
            <Store size={14} /> {shopping ? 'Shopping Mode ✓' : 'Shopping Mode'}
          </button>
          <button onClick={copyList} className="btn-secondary flex items-center gap-1.5 text-sm py-1.5">
            <Copy size={14} /> {copied ? 'Copied!' : 'Copy'}
          </button>
          <button onClick={downloadList} className="btn-secondary flex items-center gap-1.5 text-sm py-1.5">
            <Download size={14} /> Download
          </button>
          <button onClick={() => window.print()} className="btn-secondary flex items-center gap-1.5 text-sm py-1.5">
            <Printer size={14} /> Print
          </button>
        </div>
      </div>

      {stale && (
        <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
          You swapped a meal since this list was built, so it no longer matches your plan exactly.
          Regenerate the meal plan to rebuild the list.
        </div>
      )}

      {/* Totals — in shopping mode this becomes the running cart tally */}
      {shopping ? (
        <div className="sticky top-[5.5rem] z-[5] grid grid-cols-3 gap-3 mb-5 bg-white/95 backdrop-blur rounded-xl no-print">
          <div className="bg-green-50 rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-green-700">${inCartCost.toFixed(2)}</div>
            <div className="text-xs text-green-600">In Cart ({inCart.length})</div>
          </div>
          <div className="bg-amber-50 rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-amber-700">${remainingCost.toFixed(2)}</div>
            <div className="text-xs text-amber-600">Still To Get ({indexed.length - inCart.length})</div>
          </div>
          <div className="bg-gray-50 rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-gray-700">${totalCost.toFixed(2)}</div>
            <div className="text-xs text-gray-500">Estimated Total</div>
          </div>
        </div>
      ) : (
        <div className="flex gap-4 mb-5">
          <div className="flex-1 bg-green-50 rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-green-700">${totalCost.toFixed(2)}</div>
            <div className="text-xs text-green-600">Estimated Total</div>
          </div>
          <div className="flex-1 bg-red-50 rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-red-600">{onSaleCount}</div>
            <div className="text-xs text-red-500">Sale Items in Cart</div>
          </div>
          <div className="flex-1 bg-gray-50 rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-gray-700">{checked.size}</div>
            <div className="text-xs text-gray-500">Items Checked Off</div>
          </div>
        </div>
      )}

      {checked.size > 0 && (
        <button
          onClick={() => setChecked(new Set())}
          className="no-print flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 mb-3"
        >
          <RotateCcw size={12} /> Reset checked items
        </button>
      )}

      {/* Items by category */}
      <div className="space-y-4">
        {sortedCats.map(cat => {
          const items = groups[cat]
          // In shopping mode, push checked items to the bottom of their aisle
          const ordered = shopping
            ? [...items].sort((a, b) => Number(checked.has(a._id)) - Number(checked.has(b._id)))
            : items
          return (
            <div key={cat}>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">{cat}</h3>
              <div className={shopping ? 'space-y-1.5' : 'space-y-1'}>
                {ordered.map(item => {
                  const done = checked.has(item._id)
                  return (
                    <div
                      key={item._id}
                      onClick={() => toggleCheck(item._id)}
                      className={`flex items-center gap-3 rounded-lg cursor-pointer transition-all ${
                        shopping ? 'px-3 py-3.5 border border-gray-100' : 'px-3 py-2'
                      } ${done ? 'opacity-40 bg-gray-50' : 'hover:bg-gray-50'}`}
                    >
                      <div className={`rounded border-2 flex items-center justify-center shrink-0 transition-all ${
                        shopping ? 'w-7 h-7' : 'w-5 h-5'
                      } ${done ? 'bg-green-500 border-green-500' : 'border-gray-300'}`}>
                        {done && <Check size={shopping ? 16 : 12} className="text-white" strokeWidth={3} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className={`font-medium ${shopping ? 'text-base' : 'text-sm'} ${done ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                          {item.item}
                        </span>
                        <span className={`text-gray-400 ml-1.5 ${shopping ? 'text-sm' : 'text-sm'}`}>— {item.amount}</span>
                        {item.on_sale && (
                          <span className="ml-2 badge-sale">SALE ${item.sale_price?.toFixed(2)}/{item.unit}</span>
                        )}
                      </div>
                      <div className={`font-semibold text-gray-700 shrink-0 ${shopping ? 'text-base' : 'text-sm'}`}>
                        ${(item.estimated_cost ?? 0).toFixed(2)}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
