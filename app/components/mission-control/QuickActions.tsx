import Link from 'next/link'

const actions = [
  {
    title: 'Post Job',
    href: '/jobs/new',
    color: 'bg-sky-600 hover:bg-sky-500',
  },
  {
    title: 'Worker Map',
    href: '/company/worker-map',
    color: 'bg-violet-600 hover:bg-violet-500',
  },
  {
    title: 'AI Recruiting',
    href: '/company/recruiting',
    color: 'bg-emerald-600 hover:bg-emerald-500',
  },
  {
    title: 'Operations',
    href: '/company/operations',
    color: 'bg-amber-600 hover:bg-amber-500',
  },
]

export default function QuickActions() {
  return (
    <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-8">
      <h2 className="text-2xl font-black text-white">
        Quick Actions
      </h2>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {actions.map((action) => (
          <Link
            key={action.title}
            href={action.href}
            className={`${action.color} rounded-2xl p-5 text-center font-bold text-white transition-all hover:scale-[1.02]`}
          >
            {action.title}
          </Link>
        ))}
      </div>
    </section>
  )
}
