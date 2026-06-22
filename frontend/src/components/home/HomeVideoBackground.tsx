import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/cn'
import { useTheme } from '@/theme/ThemeProvider'

const HOME_VIDEO = '/media/gridlock-home-command-loop.mp4'

function canPlayHomeVideo(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(min-width: 640px)').matches
}

/**
 * Full-screen cinematic background for the public homepage / login pages.
 * The video stays visible in BOTH themes; only the left side is darkened so the
 * (light) hero text stays readable. The toggle changes the tint (cool navy ↔
 * warm amber), giving a clearly visible effect while keeping the footage on screen.
 */
export function HomeVideoBackground() {
  const { themeDefinition } = useTheme()
  const isDark = themeDefinition.isDark
  const [videoOk, setVideoOk] = useState(true)
  // Decide immediately on first paint — avoids a blank→poster→video flash on refresh.
  const [allowVideo, setAllowVideo] = useState(canPlayHomeVideo)
  const [videoReady, setVideoReady] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 640px)')
    const update = () => setAllowVideo(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  const showVideo = videoOk && allowVideo

  // If the video is already cached, onCanPlay may have fired before the listener attached.
  useEffect(() => {
    const v = videoRef.current
    if (v && v.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
      setVideoReady(true)
    }
  }, [showVideo])

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* gradient base / fallback (only seen if the video is missing or off-screen) */}
      <div
        className="absolute inset-0"
        style={{
          background: isDark
            ? 'radial-gradient(120% 120% at 15% 10%, #0b2036 0%, #06111f 55%, #040b15 100%)'
            : 'radial-gradient(120% 120% at 80% 10%, #1c2740 0%, #14223a 55%, #0c1626 100%)',
        }}
      />

      {showVideo && (
        <div className="absolute inset-0 overflow-hidden">
          <video
            ref={videoRef}
            className={cn(
              // Scale + position crop the baked-in watermark zone (hero panel crops via rounded overflow).
              'absolute inset-0 h-full w-full min-h-full min-w-full scale-[1.15] object-cover object-[46%_40%] transition-opacity duration-500',
              isDark
                ? 'brightness-[1.04] contrast-[1.16] saturate-[1.08]'
                : 'brightness-[1.08] contrast-[1.18] saturate-[1.12]',
              videoReady ? 'opacity-100' : 'opacity-0',
            )}
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            onCanPlay={() => setVideoReady(true)}
            onError={() => {
              setVideoOk(false)
              setVideoReady(false)
            }}
          >
            <source src={HOME_VIDEO} type="video/mp4" />
          </video>
          {/* Light hero scrim — keeps map nodes readable without washing the footage out */}
          <div className="hero-video-scrim opacity-55" />
          <div
            className={cn(
              'absolute inset-0 bg-gradient-to-br',
              isDark
                ? 'from-[#06111f]/52 via-[#06111f]/28 to-[#146C94]/18'
                : 'from-[#1a1206]/48 via-[#14223a]/22 to-[#146C94]/14',
            )}
          />
          <div className="command-grid absolute inset-0 opacity-[0.14]" />
          <div
            className={cn(
              'absolute inset-0',
              isDark
                ? 'bg-[radial-gradient(ellipse_at_30%_20%,rgba(34,211,238,0.14),transparent_50%)]'
                : 'bg-[radial-gradient(ellipse_at_70%_18%,rgba(245,158,11,0.12),transparent_50%)]',
            )}
          />
        </div>
      )}

      {isDark ? (
        <>
          <div className="absolute inset-0" style={{ backgroundColor: 'rgba(6, 17, 31, 0.26)' }} />
          {/* Left stays darker for hero text; right stays open so the map footage reads clearly */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#06111f]/88 via-[#06111f]/38 to-[#040b15]/42" />
          <div className="absolute inset-y-0 right-0 w-[58%] bg-gradient-to-l from-[#040b15]/62 via-[#06111f]/22 to-transparent" />
          <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-[#040b15]/55 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 h-1/4 bg-gradient-to-t from-[#040b15]/68 to-transparent" />
        </>
      ) : (
        <>
          <div className="absolute inset-0" style={{ backgroundColor: 'rgba(40, 26, 10, 0.18)' }} />
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(90deg, rgba(28,18,8,0.82) 0%, rgba(40,26,10,0.32) 40%, rgba(18,10,4,0.38) 100%)',
            }}
          />
          <div className="absolute inset-y-0 right-0 w-[58%] bg-gradient-to-l from-[#120a04]/58 via-[#1a1206]/20 to-transparent" />
          <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-[#1a1206]/50 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 h-1/4 bg-gradient-to-t from-[#1a1206]/62 to-transparent" />
        </>
      )}

      {/* Solid corner + radial fade — covers Gemini sparkle / shield mark */}
      {showVideo && (
        <>
          <div
            aria-hidden
            className={cn(
              'pointer-events-none absolute bottom-0 right-0 z-30 h-20 w-24 sm:h-24 sm:w-28',
              isDark ? 'bg-[#040b15]' : 'bg-[#120a04]',
            )}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute bottom-0 right-0 z-30 h-52 w-72 sm:h-60 sm:w-80"
            style={{
              background: isDark
                ? 'radial-gradient(ellipse 100% 100% at 100% 100%, #040b15 0%, #040b15 48%, rgba(4,11,21,0.96) 65%, transparent 82%)'
                : 'radial-gradient(ellipse 100% 100% at 100% 100%, #120a04 0%, #120a04 48%, rgba(18,10,4,0.96) 65%, transparent 82%)',
            }}
          />
        </>
      )}
    </div>
  )
}
