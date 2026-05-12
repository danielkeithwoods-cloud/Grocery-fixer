import { Tag, TrendingDown, RefreshCw } from 'lucide-react'

const CATEGORY_COLORS = {
  'Meat & Seafood': 'bg-red-50 text-red-700',
  'Produce': 'bg-green-50 text-green-700',
  'Dairy & Eggs': 'bg-yellow-50 text-yellow-700',
  'Grains & Pasta': 'bg-amber-50 text-amber-700',
  'Canned Goods': 'bg-blue-50 text-blue-700',
  'Oils & Condiments': 'bg-orange-50 text-orange-700',
  'default': 'bg-gray-100 text-gray-600',
}

function categoryColor(cat) {
  return CATEGORY_COLORS[cat] || CATEGORY_COLORS['default']
}

export default function DealsPanel({ deals, loading, onRefresh, demoMode, krogerConnected }) {
  const onSale = deals.filter(d => d.on_sale)
  const regular = deals.filter(d => !d.on_sale)
  const couponItems = deals.filter(d => d.has_coupon)
  const totalSavings = onSale.reduce((sum, d) => sum + (d.savings || 0), 0)

  if (loading) {
    return (
      <div className="card p-6">
        <h2 className="section-title flex items-center gap-2">
          <Tag size={20} className="text-green-600" />
          Current Deals
        </h2>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" />
          <span className="ml-3 text-gray-500">Scanning deals...</span>
        </div>
      </div>
    )
  }

  if (deals.length === 0) return null

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="section-title flex items-center gap-2 mb-0">
          <Tag size={20} className="text-green-600" />
          Current Deals
          <span className="text-sm font-normal text-gray-500">({onSale.length} on sale)</span>
        </h2>
        <button onClick={onRefresh} className="btn-secondary flex items-center gap-1.5 text-sm py-1.5">
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {demoMode && (
        <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
          Demo mode — showing sample deals. Connect Kroger API for live prices.
        </div>
      )}

      {/* Stats bar */}
      <div className={`grid gap-3 mb-5 ${krogerConnected ? 'grid-cols-4' : 'grid-cols-3'}`}>
        <div className="bg-green-50 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-green-700">{onSale.length}</div>
          <div className="text-xs text-green-600">Items on Sale</div>
        </div>
        <div className="bg-red-50 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-red-600">${totalSavings.toFixed(2)}</div>
          <div className="text-xs text-red-500">Total Savings</div>
        </div>
        {krogerConnected && (
          <div className="bg-purple-50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-purple-700">{couponItems.length}</div>
            <div className="text-xs text-purple-600">Digital Coupons</div>
          </div>
        )}
        <div className="bg-blue-50 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-blue-700">{deals.length}</div>
          <div className="text-xs text-blue-600">Total Products</div>
        </div>
      </div>

      {/* On Sale */}
      {onSale.length > 0 && (
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
            <TrendingDown size={14} className="text-red-500" />
            On Sale Now
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {onSale.map(deal => (
              <DealCard key={deal.product_id} deal={deal} />
            ))}
          </div>
        </div>
      )}

      {/* Regular price */}
      {regular.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-500 mb-2">Regular Price</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {regular.slice(0, 6).map(deal => (
              <DealCard key={deal.product_id} deal={deal} />
            ))}
          </div>
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
        {deal.brand && <div className="text-xs text-gray-500">{deal.brand}</div>}
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
