type Item = {
  label: string
  complete: boolean
}

type Props = {
  items: Item[]
}

export default function LaunchChecklist({
  items,
}: Props) {
  return (
    <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-8">

      <h2 className="text-2xl font-black text-white">
        Launch Checklist
      </h2>

      <div className="mt-6 space-y-3">

        {items.map((item) => (

          <div
            key={item.label}
            className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/60 px-5 py-4"
          >

            <span className="font-medium text-white">
              {item.label}
            </span>

            <span
              className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${
                item.complete
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'bg-yellow-500/20 text-yellow-400'
              }`}
            >
              {item.complete ? 'Complete' : 'Pending'}
            </span>

          </div>

        ))}

      </div>

    </section>
  )
}
