type LoadingSpinnerProps = {
  label?: string
}

export default function LoadingSpinner({
  label = 'Loading...',
}: LoadingSpinnerProps) {
  return (
    <div className="flex min-h-[220px] flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />

      <p className="mt-4 text-sm font-medium text-slate-600">
        {label}
      </p>
    </div>
  )
}