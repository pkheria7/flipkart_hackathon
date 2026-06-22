type Listener = () => void

let mockFallbackActive = false
const listeners = new Set<Listener>()

export function setMockFallbackActive(active: boolean) {
  if (mockFallbackActive !== active) {
    mockFallbackActive = active
    listeners.forEach((l) => l())
  }
}

export function isMockFallbackActive() {
  return mockFallbackActive
}

export function subscribeApiStatus(listener: Listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
