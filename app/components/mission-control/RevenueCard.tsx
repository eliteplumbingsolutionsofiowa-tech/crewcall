type Props = {
  revenue: number
}

export default function RevenueCard({
  revenue,
}: Props) {
  return (
    <div className="rounded-3xl border border-emerald-500/20 bg-slate-900/80 p-8">
      <p className="text-sm uppercase tracking-widest text-emerald-400">
        Total Platform Revenue
      </p>

      <h2 className="mt-4 text-5xl font-black text-white">
        ${revenue.toLocaleString()}
      </h2>

      <p className="mt-3 text-slate-400">
        Completed paid jobs
      </p>
    </div>
  )
}
