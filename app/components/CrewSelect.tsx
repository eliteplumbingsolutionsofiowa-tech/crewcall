import type { SelectHTMLAttributes } from 'react'

type CrewSelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string
  options: string[]
}

export function CrewSelect({
  label,
  options,
  className = '',
  ...props
}: CrewSelectProps) {
  return (
    <div className="w-full space-y-1">
      {label && (
        <label className="text-sm font-medium text-gray-700">
          {label}
        </label>
      )}

      <select
        {...props}
        className={`w-full rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 ${className}`}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  )
}