import { useEffect, useState } from 'react'
import { usePrefersReducedMotion } from './usePrefersReducedMotion'

/** Reveals `text` one character at a time. Instant under reduced motion. */
export function useTypewriter(text: string, speed = 32, startDelay = 600) {
  const reduced = usePrefersReducedMotion()
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (reduced) {
      setCount(text.length)
      return
    }
    setCount(0)
    let interval: number | undefined
    const delay = window.setTimeout(() => {
      interval = window.setInterval(() => {
        setCount((c) => {
          if (c >= text.length) {
            window.clearInterval(interval)
            return c
          }
          return c + 1
        })
      }, speed)
    }, startDelay)
    return () => {
      window.clearTimeout(delay)
      if (interval) window.clearInterval(interval)
    }
  }, [text, speed, startDelay, reduced])

  return { displayed: text.slice(0, count), done: count >= text.length }
}
