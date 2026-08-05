type Blocker = {
  title: string
  status: 'Open' | 'In Progress' | 'Done'
  priority: 'High' | 'Medium' | 'Low'
}

type Props = {
  items: Blocker[]
}

const priorityColor = {
  High: 'text-red-400 bg-red-500/10',
  Medium: 'text-yellow-400 bg-yellow-500/10',
  Low: 'text-sky-400 bg-sky-500/10',
}

const statusColor = {
  Open: 'text-red-400',
  'In Progress': 'text-yellow-400',
  Done: 'text-emerald-400',
}

export default function LaunchBlockers({ items }: Props) {
  return (
    <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-8">
      <h2 className="text-2xl font-black text-white">
        Launch Blockers
      </h2>

      <div className="mt-6 space-y-4">
        {items.map((item) => (
          <div
            key={item.title}
            className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/60 p-4"
          >
            <div>
              <p className="font-semibold text-white">
                {item.title}
              </p>

              <p className={`mt-1 text-sm ${statusColor[item.status]}`}>
                {item.status}
              </p>
            </div>

            <span
              className={`rounded-full px-3 py-1 text-xs font-bold ${priorityColor[item.priority]}`}
            >
              {item.priority}
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}
