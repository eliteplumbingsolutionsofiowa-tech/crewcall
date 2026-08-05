type Deployment = {
  name: string
  status: 'Healthy' | 'Pending' | 'Offline'
}

type Props = {
  deployments: Deployment[]
}

export default function DeploymentStatus({
  deployments,
}: Props) {
  return (
    <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-8">
      <h2 className="text-2xl font-black text-white">
        Deployments
      </h2>

      <div className="mt-6 space-y-4">
        {deployments.map((deployment) => (
          <div
            key={deployment.name}
            className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/60 px-5 py-4"
          >
            <span className="font-medium text-white">
              {deployment.name}
            </span>

            <span
              className={`rounded-full px-3 py-1 text-xs font-bold ${
                deployment.status === 'Healthy'
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : deployment.status === 'Pending'
                  ? 'bg-yellow-500/20 text-yellow-400'
                  : 'bg-red-500/20 text-red-400'
              }`}
            >
              {deployment.status}
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}
