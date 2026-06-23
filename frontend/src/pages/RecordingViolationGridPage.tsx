import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { Play } from 'lucide-react'

const TARGET_SECONDS = 25 // all videos finish at this timestamp simultaneously

const videos = [
  {
    src: '/media/demo/violations_2023_11_station_Upparpet_Traffic_PS.mp4',
    month: 'Nov 2023',
    station: 'Upparpet Traffic PS',
  },
  {
    src: '/media/demo/violations_2023_12_station_Upparpet_Traffic_PS.mp4',
    month: 'Dec 2023',
    station: 'Upparpet Traffic PS',
  },
  {
    src: '/media/demo/violations_2024_01_station_Upparpet_Traffic_PS.mp4',
    month: 'Jan 2024',
    station: 'Upparpet Traffic PS',
  },
  {
    src: '/media/demo/violations_2024_02_station_Upparpet_Traffic_PS.mp4',
    month: 'Feb 2024',
    station: 'Upparpet Traffic PS',
  },
]

interface VideoCardProps {
  src: string
  month: string
  station: string
  playbackRate: number | null
  shouldPlay: boolean
  onDuration: (dur: number) => void
  onEnded: () => void
}

function VideoCard({ src, month, station, playbackRate, shouldPlay, onDuration, onEnded }: VideoCardProps) {
  const ref = useRef<HTMLVideoElement>(null)
  const [missing, setMissing] = useState(false)

  // Start playback when parent signals
  useEffect(() => {
    const el = ref.current
    if (!el || !shouldPlay) return
    el.play().catch(() => {/* autoplay policy — user gesture already happened */})
  }, [shouldPlay])

  // Apply computed playbackRate whenever it arrives
  useEffect(() => {
    const el = ref.current
    if (!el || playbackRate === null) return
    el.playbackRate = playbackRate
  }, [playbackRate])

  // Check immediately on mount — metadata may already be available if video was cached
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (el.readyState >= 1) {
      onDuration(el.duration)
    }
  }, [onDuration])

  const handleLoadedMetadata = useCallback(() => {
    const el = ref.current
    if (!el) return
    onDuration(el.duration)
  }, [onDuration])

  if (missing) {
    return (
      <div
        data-testid="violation-video-card"
        className="relative flex flex-col items-center justify-center bg-[#0a0f1a] border border-white/8"
      >
        <p className="text-xs text-white/30 font-semibold uppercase tracking-widest">Video asset missing</p>
        <p className="mt-1 text-[10px] text-white/20">{src}</p>
      </div>
    )
  }

  return (
    <div data-testid="violation-video-card" className="relative overflow-hidden bg-black">
      <video
        ref={ref}
        src={src}
        muted
        playsInline
        preload="auto"
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={onEnded}
        onError={() => setMissing(true)}
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 px-4 pb-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/50">
          Violation accumulation
        </p>
        <p className="mt-0.5 text-lg font-bold tabular-nums text-white leading-tight">{month}</p>
        <p className="text-[11px] text-white/65">{station}</p>
      </div>
    </div>
  )
}

export function RecordingViolationGridPage() {
  const [started, setStarted] = useState(false)
  const [durations, setDurations] = useState<Record<number, number>>({})
  const [endedCount, setEndedCount] = useState(0)

  const allLoaded = Object.keys(durations).length === videos.length
  const allEnded = endedCount >= videos.length

  const rates = useMemo<number[] | null>(() => {
    if (!allLoaded) return null
    return videos.map((_, i) =>
      Math.min(16, Math.max(0.25, durations[i] / TARGET_SECONDS)),
    )
  }, [allLoaded, durations])

  const handleDuration = useCallback((idx: number, dur: number) => {
    setDurations((prev) => ({ ...prev, [idx]: dur }))
  }, [])

  const handleEnded = useCallback(() => setEndedCount((n) => n + 1), [])

  const handleStart = useCallback(() => setStarted(true), [])

  return (
    <div
      data-testid="recording-violation-grid"
      className="flex h-screen w-screen flex-col overflow-hidden bg-[#050912]"
    >
      {/* header */}
      <div className="shrink-0 px-8 pt-8 pb-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#22d3ee]/70">
          GridLock Command · Raw Data
        </p>
        <h1
          data-testid="violation-grid-title"
          className="mt-1.5 font-display text-2xl font-bold tracking-tight text-white sm:text-3xl"
        >
          Parking Violation Accumulation
        </h1>
        <p className="mt-1 max-w-xl text-sm text-white/50">
          Raw FTVR activity reveals where enforcement pressure builds over time.
        </p>
      </div>

      {/* 2×2 video grid */}
      <div className="relative grid flex-1 grid-cols-2 grid-rows-2 gap-0.5 bg-[#0d1421]">
        {videos.map((v, i) => (
          <VideoCard
            key={v.src}
            {...v}
            playbackRate={rates ? rates[i] : null}
            shouldPlay={started}
            onDuration={(dur) => handleDuration(i, dur)}
            onEnded={handleEnded}
          />
        ))}

        {/* Start overlay — shown until user clicks Start */}
        {!started && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 bg-black/60 backdrop-blur-sm">
            <div className="text-center">
              <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#22d3ee]/60">
                Ready to record
              </p>
              <p className="mt-1 text-sm text-white/40">
                {allLoaded
                  ? `All 4 videos loaded · will finish in ~${TARGET_SECONDS}s`
                  : `Loading videos… (${Object.keys(durations).length} / ${videos.length})`}
              </p>
            </div>
            <button
              type="button"
              onClick={handleStart}
              disabled={!allLoaded}
              className="group flex items-center gap-3 rounded-2xl border border-[#22d3ee]/30 bg-[#22d3ee]/10 px-8 py-4 text-sm font-bold uppercase tracking-[0.18em] text-[#22d3ee] transition-all hover:border-[#22d3ee]/60 hover:bg-[#22d3ee]/20 disabled:cursor-not-allowed disabled:opacity-30"
            >
              <Play className="h-5 w-5 fill-current transition-transform group-hover:scale-110" />
              {allLoaded ? 'Start Recording' : 'Loading…'}
            </button>
            {allLoaded && rates && (
              <p className="text-[9px] text-white/20 tabular-nums">
                {rates.map((r, i) => `${videos[i].month} ×${r.toFixed(2)}`).join('  ·  ')}
              </p>
            )}
          </div>
        )}

        {/* Completion overlay — fades in when all videos end */}
        <div
          className={`pointer-events-none absolute inset-0 bg-black/70 transition-opacity duration-1000 ${
            allEnded ? 'opacity-100' : 'opacity-0'
          }`}
        >
          {allEnded && (
            <div className="flex h-full flex-col items-center justify-center gap-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#22d3ee]/60">
                Recording complete
              </p>
              <p className="text-sm text-white/30">All violation windows captured</p>
            </div>
          )}
        </div>
      </div>

      {/* footer */}
      <div className="shrink-0 flex items-center justify-between px-8 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/20">
          GridLock Command · Flipkart Gridlock 2.0
        </p>
        {started && allLoaded && rates && (
          <p className="text-[9px] text-white/15 tabular-nums">
            {rates.map((r, i) => `${videos[i].month} ×${r.toFixed(2)}`).join('  ·  ')}
          </p>
        )}
      </div>
    </div>
  )
}
