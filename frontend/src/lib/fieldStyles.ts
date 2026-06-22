import { cn } from '@/lib/cn'

/** Theme-aware native select — readable in Aurora Dusk and Bengaluru Daylight. */
export const fieldSelectClassName = cn(
  'field-select focus-ring-command cursor-pointer appearance-none rounded-xl border px-3 py-2 text-sm font-medium',
)

/** Theme-aware text input / textarea. */
export const fieldInputClassName = cn(
  'field-input focus-ring-command rounded-xl border px-3 py-2 text-sm font-medium placeholder:opacity-60',
)

/** Compact filter-bar select (Station / Class chips). */
export const filterSelectClassName = cn(
  'field-select focus-ring-command cursor-pointer appearance-none rounded-lg border py-1.5 pl-12 pr-7 text-[11px] font-semibold',
)

/** Compact filter-bar search input. */
export const filterInputClassName = cn(
  'field-input focus-ring-command w-full rounded-lg border py-1.5 pl-8 pr-3 text-[11px] font-medium',
)
