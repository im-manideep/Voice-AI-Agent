import { useEffect, useRef } from 'react'

const VIDEO_URL =
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260328_083109_283f3553-e28f-428b-a723-d639c617eb2b.mp4'

const FADE_SECONDS = 0.5

/**
 * Cinematic looping background: rAF monitors currentTime/duration to fade in
 * over the first 0.5s and out over the last 0.5s; on `ended`, opacity drops
 * to 0, waits 100ms, rewinds and replays — a seamless manual loop.
 */
export function VideoBackground() {
  const ref = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = ref.current
    if (!video) return

    let raf = 0
    const tick = () => {
      if (video.duration && !video.ended) {
        const t = video.currentTime
        const remaining = video.duration - t
        let opacity = 1
        if (t < FADE_SECONDS) opacity = t / FADE_SECONDS
        else if (remaining < FADE_SECONDS) opacity = Math.max(0, remaining / FADE_SECONDS)
        video.style.opacity = opacity.toFixed(3)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    const onEnded = () => {
      video.style.opacity = '0'
      window.setTimeout(() => {
        video.currentTime = 0
        void video.play().catch(() => {})
      }, 100)
    }
    video.addEventListener('ended', onEnded)
    void video.play().catch(() => {})

    return () => {
      cancelAnimationFrame(raf)
      video.removeEventListener('ended', onEnded)
    }
  }, [])

  return (
    <div className="absolute z-0" style={{ inset: 'auto 0 0 0', top: '300px' }} aria-hidden>
      <video
        ref={ref}
        src={VIDEO_URL}
        muted
        playsInline
        preload="auto"
        className="h-full w-full object-cover"
        style={{ opacity: 0 }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-paper via-transparent to-paper" />
    </div>
  )
}
