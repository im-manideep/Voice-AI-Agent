import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { OrbCanvas } from '../orb/OrbCanvas'
import { useTypewriter } from '../../lib/useTypewriter'

const GREETING =
  'Glad you stopped in. I quiz you out loud on RAG, evals, agents and MCP — then adapt to how you answer. Ready?'

const PILLS: { label: string; to: string }[] = [
  { label: 'Start a session', to: '/session' },
  { label: 'View progress', to: '/progress' },
  { label: 'How it works', to: '#how' },
]

export function Hero() {
  const navigate = useNavigate()
  const { displayed, done } = useTypewriter(GREETING)
  const [pillsVisible, setPillsVisible] = useState(false)

  // Pills fade in on a fixed timer, independent of the typewriter.
  useEffect(() => {
    const t = window.setTimeout(() => setPillsVisible(true), 400)
    return () => window.clearTimeout(t)
  }, [])

  const go = (to: string) => {
    if (to.startsWith('#')) {
      document.querySelector(to)?.scrollIntoView({ behavior: 'smooth' })
    } else {
      navigate(to)
    }
  }

  return (
    <section className="relative flex h-screen flex-col justify-end overflow-hidden px-5 pb-14 sm:px-8 md:justify-center md:px-10 md:pb-0">
      {/* The orb replaces the reference design's background video. */}
      <OrbCanvas className="pointer-events-none absolute left-1/2 top-1/2 -z-0 h-[110vmin] w-[110vmin] -translate-x-1/2 -translate-y-1/2 md:left-[68%]" />

      <div className="relative z-10 max-w-xl">
        {/* Blurred intro label — the Mainframe ghost line, Recall's persona. */}
        <p
          className="pointer-events-none mb-5 select-none text-ink/80 sm:mb-6"
          style={{
            fontSize: 'clamp(17px, 3.5vw, 24px)',
            lineHeight: 1.3,
            filter: 'blur(3.5px)',
          }}
        >
          Hey there, meet Recall,
          <br />
          your voice-first AI study coach
        </p>

        <h1 className="font-display mb-5 text-ink" style={{ fontSize: 'clamp(44px, 8vw, 88px)', lineHeight: 1.02 }}>
          Study out <em className="text-aurora">loud</em>.
        </h1>

        {/* Typewriter greeting */}
        <p
          className="mb-6 text-ink sm:mb-7"
          style={{ fontSize: 'clamp(17px, 3.5vw, 24px)', lineHeight: 1.35, minHeight: '3.2em' }}
        >
          {displayed}
          {!done && <span className="caret" />}
        </p>

        {/* Pill CTAs — fade in + slide up */}
        <div
          className="flex flex-wrap gap-x-2 gap-y-2"
          style={{
            opacity: pillsVisible ? 1 : 0,
            transform: pillsVisible ? 'translateY(0)' : 'translateY(8px)',
            transition: 'opacity 0.4s ease, transform 0.4s ease',
          }}
        >
          {PILLS.map((p, i) => (
            <button
              key={p.label}
              type="button"
              onClick={() => go(p.to)}
              className={`${i === 0 ? 'pill-solid' : 'pill'} text-[14px] sm:text-[15px]`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <p className="mt-6 text-[13px] text-mist">
          Voice in, voice out — no typing. Works best in Chrome, with headphones.
        </p>
      </div>
    </section>
  )
}
