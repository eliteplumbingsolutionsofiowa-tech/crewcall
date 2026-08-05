import { Activity } from '@/hooks/useRecentActivity'

type Props = {
  items: Activity[]
}

export default function RecentActivity({
  items,
}: Props) {
  return (
    <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-8">
      <h2 className="text-2xl font-black text-white">
        Recent Activity
      </h2>

      <div className="mt-6 space-y-4">
        {items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-700 p-6 text-center text-slate-500">
            No recent activity.
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className="rounded-2xl border border-white/10 bg-slate-950/60 p-4 transition hover:border-sky-500/30"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-white">
                  {item.title}
                </h3>

                <span className="rounded-full bg-sky-500/10 px-3 py-1 text-xs text-sky-400">
                  Job
                </span>
              </div>

              <p className="mt-2 text-sm text-slate-400">
                {item.created_at
                  ? new Date(item.created_at).toLocaleString()
                  : 'Unknown'}
              </p>
            </div>
          ))
        )}
      </div>
    </section>
  )
}
