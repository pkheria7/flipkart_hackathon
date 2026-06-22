const DEFAULT_DELAY_MS = 280

export function mockDelay(ms = DEFAULT_DELAY_MS): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
