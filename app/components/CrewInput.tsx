import type { InputHTMLAttributes } from 'react'

type CrewInputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string
}

export function CrewInput({ label, className = '', ...props }: CrewInputProps) {
  return (
    <div className="w-full space-y-1">
      {label && (
        <label className="text-sm font-medium text-gray-700">
          {label}
        </label>
      )}

      <input
        {...props}
        className={`w-full rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 ${className}`}
      />
    </div>
  )
}