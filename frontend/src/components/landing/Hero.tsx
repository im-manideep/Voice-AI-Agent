import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { OrbCanvas } from '../orb/OrbCanvas'
import { useTypewriter } from '../../lib/useTypewriter'

const GREETING =
  'Glad you stopped in. I quiz you out loud on RAG, evals, agents and MCP — grade your answer, teach what you missed, and adapt. Ready?'

const PILLS: { label: string; to: string }[] = [
  { label: 'Start a session', to: '/session' },
  { label: 'View progress', to: '/progress' },
  { label: 'How it works', to: '#how' },
]

const TOPICS = [
  'Chunking & Hybrid Retrieval',
  'Reranking',
  'RAG Evaluation Metrics',
  'LLM-as-Judge Pitfalls',
  'Agent Orchestration & LangGraph',
  'MCP Basics',
  'Provider Abstraction',
  'Deployment & Cost Guards',
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
    <section className="relative flex h-screen flex-col justify-end overflow-hidden px-5 pb-8 sm:px-8 md:justify-center md:px-10 md:pb-0">
      {/* The orb replaces the reference design's background video. */}
      <OrbCanvas className="pointer-events-none absolute left-1/2 top-1/2 z-0 h-[100vmin] w-[100vmin] -translate-x-1/2 -translate-y-1/2 opacity-90 md:left-[70%]" />
      {/* Legibility scrim behind the copy */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'linear-gradient(100deg, rgb(7 8 15 / 0.88) 0%, rgb(7 8 15 / 0.55) 42%, transparent 72%)',
        }}
      />

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

        <h1
          className="font-display mb-5 text-ink"
          style={{ fontSize: 'clamp(44px, 8vw, 88px)', lineHeight: 1.02 }}
        >
          Study out <em className="text-aurora-gradient">loud</em>.
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
          Voice in, voice out — no typing. Say <span className="text-ink/70">“explain that”</span>{' '}
          anytime for a mini-lesson. Chrome + headphones recommended.
        </p>
      </div>

      {/* Topic marquee — what it can quiz you on */}
      <div
        className="absolute bottom-0 left-0 right-0 z-10 border-t border-white/6 py-4"
        style={{
          maskImage: 'linear-gradient(90deg, transparent, black 12%, black 88%, transparent)',
          WebkitMaskImage: 'linear-gradient(90deg, transparent, black 12%, black 88%, transparent)',
        }}
      >
        <div className="marquee-track">
          {[0, 1].map((copy) => (
            <div key={copy} className="flex shrink-0 items-center" aria-hidden={copy === 1}>
              {TOPICS.map((t) => (
                <span key={t} className="flex items-center whitespace-nowrap text-[13px] text-mist">
                  <span className="px-4">{t}</span>
                  <span className="text-aurora/60">✳</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
