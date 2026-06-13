'use client'

type Props = {
  trade: string
  location: string
  openOnly: boolean
  onTradeChange: (value: string) => void
  onLocationChange: (value: string) => void
  onOpenOnlyChange: (value: boolean) => void
  onClear: () => void
}

export default function JobFilters({
  trade,
  location,
  openOnly,
  onTradeChange,
  onLocationChange,
  onOpenOnlyChange,
  onClear,
}: Props) {
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1fr_230px_190px]">
      <label className="block">
        <span className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-600">
          Trade
        </span>
        <input
          value={trade}
          onChange={(event) => onTradeChange(event.target.value)}
          placeholder="Plumbing, HVAC, electrical..."
          className="w-full rounded-2xl border-2 border-slate-300 bg-white px-5 py-4 text-sm font-bold text-slate-950 shadow-sm outline-none placeholder:text-slate-400 focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
        />
      </label>

      <label className="block">
        <span className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-600">
          Location
        </span>
        <input
          value={location}
          onChange={(event) => onLocationChange(event.target.value)}
          placeholder="Des Moines, Ames..."
          className="w-full rounded-2xl border-2 border-slate-300 bg-white px-5 py-4 text-sm font-bold text-slate-950 shadow-sm outline-none placeholder:text-slate-400 focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
        />
      </label>

      <label className="flex cursor-pointer items-center gap-3 rounded-2xl border-2 border-slate-900 bg-slate-950 px-5 py-4 text-sm font-black text-white shadow-sm transition hover:scale-[1.01]">
        <input
          type="checkbox"
          checked={openOnly}
          onChange={(event) => onOpenOnlyChange(event.target.checked)}
          className="h-5 w-5 cursor-pointer accent-orange-500"
        />
        Open jobs only
      </label>

      <button
        type="button"
        onClick={onClear}
        className="rounded-2xl border-2 border-slate-900 bg-white px-5 py-4 text-sm font-black text-slate-950 shadow-sm transition hover:scale-[1.01] hover:bg-slate-100"
      >
        Clear Filters
      </button>
    </div>
  )
}