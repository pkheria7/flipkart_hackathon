import { mockDelay } from '@/lib/mockDelay'
import { setMockFallbackActive } from '@/lib/apiStatus'
import { API_BASE_URL, USE_MOCK_DATA } from './config'

const REQUEST_TIMEOUT_MS = 8_000

async function fetchWithTimeout(
  url: string,
  init?: RequestInit,
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

function normalizePath(path: string): string {
  return path.startsWith('/') ? path : `/${path}`
}

export async function apiGet<T>(path: string, fallback: T): Promise<T> {
  if (USE_MOCK_DATA) {
    await mockDelay()
    return fallback
  }

  const url = `${API_BASE_URL}${normalizePath(path)}`
  try {
    const response = await fetchWithTimeout(url)
    if (!response.ok) {
      throw new Error(`GET ${path} failed: HTTP ${response.status}`)
    }
    return (await response.json()) as T
  } catch (error) {
    console.warn(`[API fallback] GET ${path}`, error)
    setMockFallbackActive(true)
    await mockDelay()
    return fallback
  }
}

export async function apiPost<T>(
  path: string,
  body?: unknown,
  fallback?: T,
): Promise<T> {
  if (USE_MOCK_DATA) {
    await mockDelay()
    if (fallback !== undefined) return fallback
    return { ok: true, message: 'mock' } as T
  }

  const url = `${API_BASE_URL}${normalizePath(path)}`
  try {
    const response = await fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
    if (!response.ok) {
      throw new Error(`POST ${path} failed: HTTP ${response.status}`)
    }
    return (await response.json()) as T
  } catch (error) {
    console.warn(`[API fallback] POST ${path}`, error)
    setMockFallbackActive(true)
    await mockDelay()
    if (fallback !== undefined) return fallback
    return { ok: false, message: 'API unavailable' } as T
  }
}

/** @deprecated Use apiGet */
export const fetchWithMockFallback = apiGet
