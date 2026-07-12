'use client'

type CrewCallToastProps = {
  open: boolean
  title: string
  body?: string | null
  actionLabel?: string
  onAction?: () => void
  onDismiss: () => void
}

export default function CrewCallToast({
  open,
  title,
  body,
  actionLabel = 'Open',
  onAction,
  onDismiss,
}: CrewCallToastProps) {
  if (!open) return null

  return (
    <div className="fixed right-4 top-24 z-[100] w-[calc(100%-2rem)] max-w-md">
      <div className="rounded-3xl border border-cyan-300/30 bg-slate-950/95 p-5 shadow-2xl shadow-cyan-500/20 backdrop-blur-xl">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-cyan-400 text-xl text-slate-950">
            🔔
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">
              CrewCall Alert
            </p>

            <h2 className="mt-1 text-lg font-black text-white">{title}</h2>

            {body && (
              <p className="mt-2 line-clamp-3 text-sm font-semibold leading-6 text-slate-300">
                {body}
              </p>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              {onAction && (
                <button
                  type="button"
                  onClick={onAction}
                  className="rounded-xl bg-cyan-400 px-4 py-2 text-sm font-black text-slate-950 transition hover:bg-cyan-300"
                >
                  {actionLabel}
                </button>
              )}

              <button
                type="button"
                onClick={onDismiss}
                className="rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-black text-white transition hover:bg-white/20"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}