import { useState } from 'react'
import { ShoppingCart, Check, Download } from 'lucide-react'

const CATEGORY_ORDER = [
  'Meat & Seafood', 'Produce', 'Dairy & Eggs', 'Grains & Pasta',
  'Canned Goods', 'Oils & Condiments', 'Frozen', 'Bakery', 'Other'
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

export default function GroceryList({ groceryList }) {
  const [checked, setChecked] = useState(new Set())

  if (!groceryList || groceryList.length === 0) return null

  const groups = groupByCategory(groceryList)
  const totalCost = groceryList.reduce((s, i) => s + (i.estimated_cost || 0), 0)
  const onSaleCount = groceryList.filter(i => i.on_sale).length

  function toggleCheck(item) {
    setChecked(prev => {
      const next = new Set(prev)
      if (next.has(item)) next.delete(item)
      else next.add(item)
      return next
    })
  }

  function downloadList() {
    const lines = ['GROCERY LIST', '============', '']
    const sortedCats = CATEGORY_ORDER.filter(c => groups[c]).concat(
      Object.keys(groups).filter(c => !CATEGORY_ORDER.includes(c))
    )
    for (const cat of sortedCats) {
      lines.push(`${cat.toUpperCase()}`)
      for (const item of groups[cat]) {
        const sale = item.on_sale ? ` [SALE: $${item.sale_price?.toFixed(2)}/${item.unit}]` : ''
        lines.push(`  □ ${item.item} — ${item.amount} — $${item.estimated_cost.toFixed(2)}${sale}`)
      }
      lines.push('')
    }
    lines.push(`ESTIMATED TOTAL: $${totalCost.toFixed(2)}`)

    const blob = new Blob([lines.join('\n')], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'grocery-list.txt'
    a.click()
    URL.revokeObjectURL(url)
  }

  const sortedCats = CATEGORY_ORDER.filter(c => groups[c]).concat(
    Object.keys(groups).filter(c => !CATEGORY_ORDER.includes(c))
  )

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="section-title flex items-center gap-2 mb-0">
          <ShoppingCart size={20} className="text-green-600" />
          Grocery List
          <span className="text-sm font-normal text-gray-500">({groceryList.length} items)</span>
        </h2>
        <button onClick={downloadList} className="btn-secondary flex items-center gap-1.5 text-sm py-1.5">
          <Download size={14} />
          Download
        </button>
      </div>

      {/* Totals */}
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

      {/* By category */}
      <div className="space-y-4">
        {sortedCats.map(cat => (
          <div key={cat}>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">{cat}</h3>
            <div className="space-y-1">
              {groups[cat].map((item, i) => {
                const id = `${cat}-${i}`
                const done = checked.has(id)
                return (
                  <div
                    key={id}
                    onClick={() => toggleCheck(id)}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-all ${
                      done ? 'opacity-40 bg-gray-50' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all ${
                      done ? 'bg-green-500 border-green-500' : 'border-gray-300'
                    }`}>
                      {done && <Check size={12} className="text-white" strokeWidth={3} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className={`text-sm font-medium ${done ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                        {item.item}
                      </span>
                      <span className="text-sm text-gray-400 ml-1.5">— {item.amount}</span>
                      {item.on_sale && (
                        <span className="ml-2 badge-sale">SALE ${item.sale_price?.toFixed(2)}/{item.unit}</span>
                      )}
                    </div>
                    <div className="text-sm font-semibold text-gray-700 shrink-0">
                      ${item.estimated_cost.toFixed(2)}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
