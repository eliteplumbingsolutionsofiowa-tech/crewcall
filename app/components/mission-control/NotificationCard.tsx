type Props = {
  count: number
}

export default function NotificationCard({
  count,
}: Props) {
  return (
    <div className="rounded-3xl border border-red-500/20 bg-slate-900/80 p-8">

      <p className="text-sm uppercase tracking-widest text-red-400">
        Unread Notifications
      </p>

      <h2 className="mt-4 text-5xl font-black text-white">
        {count}
      </h2>

      <p className="mt-3 text-slate-400">
        Requires attention
      </p>

    </div>
  )
}
