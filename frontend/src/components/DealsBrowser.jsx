import { useState, useMemo } from 'react'
import { Tag, RefreshCw, Search, SlidersHorizontal } from 'lucide-react'

const CATEGORY_COLORS = {
  'Meat & Seafood': 'bg-red-50 text-red-700',
  'Produce': 'bg-green-50 text-green-700',
  'Dairy & Eggs': 'bg-yellow-50 text-yellow-700',
  'Grains & Pasta': 'bg-amber-50 text-amber-700',
  'Canned Goods': 'bg-blue-50 text-blue-700',
  'Oils & Condiments': 'bg-orange-50 text-orange-700',
  'Snacks': 'bg-purple-50 text-purple-700',
  'Frozen': 'bg-cyan-50 text-cyan-700',
  'Beverages': 'bg-pink-50 text-pink-700',
  'Bakery': 'bg-rose-50 text-rose-700',
  'default': 'bg-gray-100 text-gray-600',
}

function categoryColor(cat) {
  return CATEGORY_COLORS[cat] || CATEGORY_COLORS['default']
}

const SORT_OPTIONS = [
  { value: 'savings', label: 'Biggest Savings' },
  { value: 'price_low', label: 'Price: Low to High' },
  { value: 'price_high', label: 'Price: High to Low' },
  { value: 'name', label: 'Name (A–Z)' },
]

export default function DealsBrowser({ deals, loading, onRefresh, demoMode, krogerConnected }) {
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('All')
  const [saleOnly, setSaleOnly] = useState(true)
  const [sort, setSort] = useState('savings')

  const categories = useMemo(() => {
    const set = new Set(deals.map(d => d.category).filter(Boolean))
    return ['All', ...Array.from(set).sort()]
  }, [deals])

  const filtered = useMemo(() => {
    let list = deals
    if (saleOnly) list = list.filter(d => d.on_sale)
    if (activeCategory !== 'All') list = list.filter(d => d.category === activeCategory)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(d => d.name.toLowerCase().includes(q) || (d.brand || '').toLowerCase().includes(q))
    }
    const sorted = [...list]
    sorted.sort((a, b) => {
      if (sort === 'savings') return (b.savings || 0) - (a.savings || 0)
      if (sort === 'price_low') return a.sale_price - b.sale_price
      if (sort === 'price_high') return b.sale_price - a.sale_price
      if (sort === 'name') return a.name.localeCompare(b.name)
      return 0
    })
    return sorted
  }, [deals, saleOnly, activeCategory, search, sort])

  const onSaleCount = deals.filter(d => d.on_sale).length
  const couponCount = deals.filter(d => d.has_coupon).length
  const totalSavings = deals.filter(d => d.on_sale).reduce((s, d) => s + (d.savings || 0), 0)

  if (loading) {
    return (
      <div className="card p-6">
        <h2 className="section-title flex items-center gap-2"><Tag size={20} className="text-green-600" /> All Deals</h2>
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" />
          <span className="ml-3 text-gray-500">Scanning every aisle for deals...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="section-title flex items-center gap-2 mb-0">
          <Tag size={20} className="text-green-600" />
          All Deals
          <span className="text-sm font-normal text-gray-500">({deals.length} products)</span>
        </h2>
        <button onClick={onRefresh} className="btn-secondary flex items-center gap-1.5 text-sm py-1.5">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {demoMode && (
        <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
          Demo mode — showing sample deals. Connect Kroger API for live prices.
        </div>
      )}

      {/* Stats */}
      <div className={`grid gap-3 mb-5 ${krogerConnected ? 'grid-cols-4' : 'grid-cols-3'}`}>
        <div className="bg-green-50 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-green-700">{onSaleCount}</div>
          <div className="text-xs text-green-600">On Sale</div>
        </div>
        <div className="bg-red-50 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-red-600">${totalSavings.toFixed(2)}</div>
          <div className="text-xs text-red-500">Total Savings</div>
        </div>
        {krogerConnected && (
          <div className="bg-purple-50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-purple-700">{couponCount}</div>
            <div className="text-xs text-purple-600">Digital Coupons</div>
          </div>
        )}
        <div className="bg-blue-50 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-blue-700">{categories.length - 1}</div>
          <div className="text-xs text-blue-600">Categories</div>
        </div>
      </div>

      {/* Search + sort */}
      <div className="flex flex-col sm:flex-row gap-2 mb-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="input pl-9"
            placeholder="Search products..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <SlidersHorizontal size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <select className="input pl-8 pr-8" value={sort} onChange={e => setSort(e.target.value)}>
              {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <button
            onClick={() => setSaleOnly(s => !s)}
            className={`px-3 py-2 rounded-lg text-sm font-medium border transition-all whitespace-nowrap ${
              saleOnly ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-600 border-gray-200'
            }`}
          >
            {saleOnly ? 'Sale Only ✓' : 'Sale Only'}
          </button>
        </div>
      </div>

      {/* Category chips */}
      <div className="flex gap-1.5 overflow-x-auto pb-2 mb-4">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-all ${
              activeCategory === cat ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Results */}
      {filtered.length === 0 ? (
        <div className="text-center text-gray-400 py-12 text-sm">No products match your filters.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {filtered.map(deal => (
            <DealCard key={deal.product_id} deal={deal} />
          ))}
        </div>
      )}
    </div>
  )
}

function DealCard({ deal }) {
  const catClass = categoryColor(deal.category)
  const borderClass = deal.has_coupon
    ? 'border-purple-200 bg-purple-50/30'
    : deal.on_sale
    ? 'border-green-200 bg-green-50/30'
    : 'border-gray-100 bg-gray-50/30'
  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg border ${borderClass}`}>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm text-gray-800 truncate">{deal.name}</div>
        {deal.brand && <div className="text-xs text-gray-500 truncate">{deal.brand}</div>}
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${catClass}`}>{deal.category}</span>
          {deal.size && <span className="text-xs text-gray-400">{deal.size}</span>}
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className="font-bold text-sm text-green-700">${deal.sale_price.toFixed(2)}</div>
        {deal.on_sale && (
          <>
            <div className="text-xs text-gray-400 line-through">${deal.regular_price.toFixed(2)}</div>
            {deal.has_coupon
              ? <span className="inline-flex items-center gap-1 bg-purple-100 text-purple-700 text-xs font-semibold px-2 py-0.5 rounded-full">Coupon -${deal.savings.toFixed(2)}</span>
              : <div className="badge-sale">Save ${deal.savings.toFixed(2)}</div>
            }
          </>
        )}
      </div>
    </div>
  )
}
