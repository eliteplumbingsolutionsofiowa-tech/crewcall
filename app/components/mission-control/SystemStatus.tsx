type System = {
  name: string
  healthy: boolean
}

type Props = {
  systems: System[]
}

export default function SystemStatus({
  systems,
}: Props) {
  return (
    <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-8">

      <h2 className="text-2xl font-black text-white">
        System Health
      </h2>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">

        {systems.map((system) => (

          <div
            key={system.name}
            className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/60 px-5 py-4"
          >

            <span className="font-medium text-white">
              {system.name}
            </span>

            <div className="flex items-center gap-3">

              <span
                className={`h-3 w-3 rounded-full ${
                  system.healthy
                    ? 'bg-emerald-400'
                    : 'bg-yellow-400'
                }`}
              />

              <span
                className={
                  system.healthy
                    ? 'text-emerald-400'
                    : 'text-yellow-400'
                }
              >
                {system.healthy
                  ? 'Healthy'
                  : 'Pending'}
              </span>

            </div>

          </div>

        ))}

      </div>

    </section>
  )
}
