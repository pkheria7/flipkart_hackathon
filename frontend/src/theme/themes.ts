export type ThemeId = 'aurora-dusk' | 'bengaluru-daylight'

export interface ThemeDefinition {
  id: ThemeId
  name: string
  shortLabel: string
  description: string
  isDark: boolean
  swatches: [string, string, string, string]
}

export const THEME_STORAGE_KEY = 'gridlock-command-theme'

export const DEFAULT_THEME_ID: ThemeId = 'bengaluru-daylight'

export const themes: ThemeDefinition[] = [
  {
    id: 'aurora-dusk',
    name: 'Aurora Command — Dusk',
    shortLabel: 'Aurora Dusk',
    description: 'Default cinematic command navy with cyan aurora glow.',
    isDark: true,
    swatches: ['#06111F', '#0B3A6F', '#22D3EE', '#F59E0B'],
  },
  {
    id: 'bengaluru-daylight',
    name: 'Bengaluru Daylight',
    shortLabel: 'Daylight',
    description: 'Warm paper canvas with official indigo and teal accents.',
    isDark: false,
    swatches: ['#FBF7F0', '#2D3A66', '#C2410C', '#F3EBDD'],
  },
]

/** Legacy theme ids from earlier builds — map to the closest remaining option. */
const LEGACY_LIGHT_THEMES = new Set(['mint-command', 'arctic-slate', 'periwinkle-ops'])

export function getThemeById(id: string): ThemeDefinition {
  if (LEGACY_LIGHT_THEMES.has(id)) return themes[1]
  return themes.find((t) => t.id === id) ?? themes.find((t) => t.id === DEFAULT_THEME_ID)!
}

export function isValidThemeId(id: string): id is ThemeId {
  return themes.some((t) => t.id === id)
}

export function normalizeThemeId(id: string): ThemeId {
  if (isValidThemeId(id)) return id
  if (LEGACY_LIGHT_THEMES.has(id)) return 'bengaluru-daylight'
  return DEFAULT_THEME_ID
}

export function toggleThemeId(current: ThemeId): ThemeId {
  return current === 'aurora-dusk' ? 'bengaluru-daylight' : 'aurora-dusk'
}
