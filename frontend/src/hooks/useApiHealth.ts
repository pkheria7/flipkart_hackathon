import { useSyncExternalStore } from 'react'
import { useQuery } from '@tanstack/react-query'
import { isMockFallbackActive, subscribeApiStatus } from '@/lib/apiStatus'
import { USE_MOCK_DATA } from '@/services/config'
import { getHealth } from '@/services/summaryService'

export type ApiConnectionStatus = 'connected' | 'mock-mode' | 'offline' | 'fallback'

export function useApiHealth() {
  const fallbackActive = useSyncExternalStore(
    subscribeApiStatus,
    isMockFallbackActive,
    () => false,
  )

  const healthQuery = useQuery({
    queryKey: ['health'],
    queryFn: getHealth,
    refetchInterval: 30_000,
    retry: 1,
    staleTime: 15_000,
  })

  let status: ApiConnectionStatus = 'offline'
  if (USE_MOCK_DATA) {
    status = 'mock-mode'
  } else if (healthQuery.data?.ok) {
    status = fallbackActive ? 'fallback' : 'connected'
  } else if (fallbackActive) {
    status = 'fallback'
  }

  const label =
    status === 'connected'
      ? healthQuery.data?.mode === 'file-backed'
        ? 'File-backed API'
        : 'API Connected'
      : status === 'mock-mode'
        ? 'Mock Mode'
        : status === 'fallback'
          ? 'Offline Fallback'
          : 'API Offline'

  return {
    status,
    label,
    health: healthQuery.data,
    isLoading: healthQuery.isLoading,
    refetch: healthQuery.refetch,
  }
}
