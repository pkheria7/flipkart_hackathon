import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  DEFAULT_THEME_ID,
  THEME_STORAGE_KEY,
  getThemeById,
  normalizeThemeId,
  themes,
  type ThemeDefinition,
  type ThemeId,
} from './themes'

interface ThemeContextValue {
  theme: ThemeId
  themeDefinition: ThemeDefinition
  setTheme: (id: ThemeId) => void
  themes: ThemeDefinition[]
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function readStoredTheme(): ThemeId {
  if (typeof window === 'undefined') return DEFAULT_THEME_ID
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    if (stored) return normalizeThemeId(stored)
  } catch {
    /* ignore */
  }
  return DEFAULT_THEME_ID
}

function applyThemeToDocument(id: ThemeId) {
  const def = getThemeById(id)
  const root = document.documentElement
  root.dataset.theme = id
  root.dataset.themeMode = def.isDark ? 'dark' : 'light'
  root.style.colorScheme = def.isDark ? 'dark' : 'light'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>(() => readStoredTheme())

  const setTheme = useCallback((id: ThemeId) => {
    setThemeState(id)
    try {
      localStorage.setItem(THEME_STORAGE_KEY, id)
    } catch {
      /* ignore */
    }
    applyThemeToDocument(id)
  }, [])

  useEffect(() => {
    applyThemeToDocument(theme)
  }, [theme])

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      themeDefinition: getThemeById(theme),
      setTheme,
      themes,
    }),
    [theme, setTheme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function bootstrapTheme(): ThemeId {
  const id = readStoredTheme()
  applyThemeToDocument(id)
  return id
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
