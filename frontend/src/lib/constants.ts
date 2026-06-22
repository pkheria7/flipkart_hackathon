export const APP_NAME = 'GridLock Command'
export const APP_SUBTITLE = 'Parking Impact Intelligence — Bengaluru Traffic Police'

export const BTP_STATIONS = [
  'ADUGODI',
  'INDIRANAGAR',
  'KORAMANGALA',
  'HSR_LAYOUT',
  'WHITEFIELD',
  'JAYANAGARA',
  'RAJAJINAGAR',
  'HEBBALA',
] as const

export const CLASSIFICATIONS = [
  'STRUCTURAL',
  'RESPONSIVE',
  'SEASONAL',
] as const

/** @deprecated Use PLAUSIBLE_IST_ENFORCEMENT_WINDOWS from `@/lib/timezone`. */
export { PLAUSIBLE_IST_ENFORCEMENT_WINDOWS as PEAK_WINDOWS } from '@/lib/timezone'

export const DEFAULT_MAP_CENTER = {
  lat: 12.9716,
  lng: 77.5946,
} as const

export const DEFAULT_MAP_ZOOM = 11
