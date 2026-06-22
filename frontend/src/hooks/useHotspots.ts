import { useEffect, useMemo, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getHotspots } from '@/services/hotspotService'
import { toCommandHotspots, type CommandHotspot } from '@/lib/hotspots'
import { maybeLogPeakWindowVerification } from '@/lib/timezone'

/**
 * Working-set size for the frontend. The backend holds ~1,084 hotspots; a single
 * request returns them all and MapLibre renders them as one GeoJSON source (cheap).
 * Boards/lists page locally on top of this cached set, so every consumer shares one fetch.
 */
export const HOTSPOT_WORKING_SET = 1500

interface UseHotspotsResult {
  hotspots: CommandHotspot[]
  isLoading: boolean
  isError: boolean
  refetch: () => void
}

/**
 * Shared, normalized, ROI-sorted hotspot query. All map/board/comparison views read
 * from the same cache key so there is exactly one network round-trip per session.
 */
export function useHotspots(limit: number = HOTSPOT_WORKING_SET): UseHotspotsResult {
  const query = useQuery({
    queryKey: ['hotspots', limit],
    queryFn: () => getHotspots({ limit, sort_by: 'roi_score' }),
    staleTime: 60_000,
  })

  const hotspots = useMemo(() => {
    const list = toCommandHotspots(query.data)
    return list.sort((a, b) => b.roi - a.roi)
  }, [query.data])

  const verifiedRef = useRef(false)
  useEffect(() => {
    if (verifiedRef.current || hotspots.length === 0) return
    verifiedRef.current = true
    const sampleIds = ['C_0_0', 'C_298', 'C_22']
    const samples = sampleIds
      .map((id) => hotspots.find((h) => h.cluster_id === id))
      .filter((h): h is CommandHotspot => !!h)
      .map((h) => ({
        cluster_id: h.cluster_id,
        peak_window: h.raw.peak_window ?? h.peak_window,
        station: h.station,
      }))
    if (samples.length > 0) maybeLogPeakWindowVerification(samples)
  }, [hotspots])

  return {
    hotspots,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: () => void query.refetch(),
  }
}
