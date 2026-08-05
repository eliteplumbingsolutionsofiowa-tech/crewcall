type StatCardProps = {
  title: string
  value: string | number
  icon: string
  color: string
  subtitle?: string
}

export default function StatCard({
  title,
  value,
  icon,
  color,
  subtitle,
}: StatCardProps) {
  return (
    <div className="group rounded-3xl border border-white/10 bg-slate-900/80 p-6 transition-all duration-300 hover:-translate-y-1 hover:border-sky-500/40 hover:bg-slate-900">
      <div
        className={`flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br ${color} text-3xl shadow-lg`}
      >
        {icon}
      </div>

      <p className="mt-5 text-sm font-semibold uppercase tracking-widest text-slate-400">
        {title}
      </p>

      <h2 className="mt-2 text-5xl font-black text-white">
        {value}
      </h2>

      {subtitle && (
        <p className="mt-2 text-sm text-emerald-400">
          {subtitle}
        </p>
      )}
    </div>
  )
}
