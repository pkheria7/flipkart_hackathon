import { ChevronDown } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-civic-ivory/50">
      {children}
    </span>
  )
}

interface FieldSelectProps {
  label: string
  value: string
  onChange: (v: string) => void
  options: Array<{ value: string; label: string }>
  className?: string
}

export function FieldSelect({ label, value, onChange, options, className }: FieldSelectProps) {
  return (
    <label className={cn('block', className)}>
      <FieldLabel>{label}</FieldLabel>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="focus-ring-command w-full cursor-pointer appearance-none rounded-xl border border-btp-cyan/15 bg-civic-dusk/70 py-2.5 pl-3 pr-9 text-sm font-semibold text-civic-white"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-civic-ivory/45" />
      </div>
    </label>
  )
}

interface FieldInputProps {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
}

export function FieldInput({ label, value, onChange, placeholder, className }: FieldInputProps) {
  return (
    <label className={cn('block', className)}>
      <FieldLabel>{label}</FieldLabel>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="focus-ring-command w-full rounded-xl border border-btp-cyan/15 bg-civic-dusk/70 py-2.5 px-3 text-sm text-civic-white placeholder:text-civic-ivory/35"
      />
    </label>
  )
}

interface FieldTextareaProps {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
}

export function FieldTextarea({ label, value, onChange, placeholder, className }: FieldTextareaProps) {
  return (
    <label className={cn('block', className)}>
      <FieldLabel>{label}</FieldLabel>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={2}
        className="focus-ring-command w-full resize-none rounded-xl border border-btp-cyan/15 bg-civic-dusk/70 py-2.5 px-3 text-sm text-civic-white placeholder:text-civic-ivory/35"
      />
    </label>
  )
}
