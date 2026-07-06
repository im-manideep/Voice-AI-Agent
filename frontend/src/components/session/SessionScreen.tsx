import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BookOpen, GraduationCap, Mic, MicOff, Square, Volume2 } from 'lucide-react'
import { OrbCanvas } from '../orb/OrbCanvas'
import { voiceLoop } from '../../lib/voiceLoop'
import { useSessionStore } from '../../store/sessionStore'
import { useVoiceStore } from '../../store/voiceStore'

const STATE_LABEL: Record<string, string> = {
  listening: 'listening',
  thinking: 'thinking',
  speaking: 'speaking',
}

const ERROR_COPY: Record<string, string> = {
  'mic-denied': 'Microphone access was denied — allow it in the address bar, then try again.',
  unsupported: 'This browser has no Web Speech support. Please use Chrome (desktop).',
  network: 'Connection hiccup — speech recognition needs internet and the backend must be running.',
}

// What the coach understands, beyond a plain answer. Shown before and during
// the session so nobody has to guess what they can say.
const YOU_CAN_SAY = [
  { icon: GraduationCap, phrase: '“explain that”', meaning: 'get a mini-lesson, no penalty' },
  { icon: BookOpen, phrase: '“skip”', meaning: 'move to the next question' },
  { icon: Volume2, phrase: '“stop”', meaning: 'end the session' },
]

export function SessionScreen() {
  const navigate = useNavigate()
  const { status, mode, muted, interim, error } = useVoiceStore()
  const { sessionId, question, feedback, assignment, lastVerdict, over } = useSessionStore()
  const [starting, setStarting] = useState(false)

  const live = !!sessionId && !over

  // Session finished (coach heard "stop" or End pressed) -> dashboard.
  useEffect(() => {
    if (over && sessionId) navigate('/progress')
  }, [over, sessionId, navigate])

  // Leaving the screen tears the loop down.
  useEffect(() => () => voiceLoop.end(), [])

  // Spacebar = push-to-talk in PTT mode.
  useEffect(() => {
    if (!live || mode !== 'ptt') return
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault()
        voiceLoop.pttDown()
      }
    }
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault()
        voiceLoop.pttUp()
      }
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [live, mode])

  const begin = async () => {
    setStarting(true)
    try {
      await voiceLoop.begin()
    } finally {
      setStarting(false)
    }
  }

  /* ---------------------------------------------------------------- */
  /* Pre-session                                                       */
  /* ---------------------------------------------------------------- */
  if (!live) {
    return (
      <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-5 py-24">
        {/* Orb glows dimly BEHIND the card, never under the text. */}
        <OrbCanvas className="pointer-events-none absolute left-1/2 top-1/2 h-[70vmin] w-[70vmin] -translate-x-1/2 -translate-y-1/2 opacity-60" />
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: 'radial-gradient(ellipse at center, rgb(7 8 15 / 0.55) 0%, rgb(7 8 15 / 0.2) 45%, transparent 70%)' }}
        />

        <div className="glass relative z-10 w-full max-w-lg p-8 text-center sm:p-10">
          <p className="mb-3 text-[12px] uppercase tracking-[0.3em] text-aurora">voice session</p>
          <h1 className="font-display mb-4 text-5xl text-ink sm:text-6xl">
            Ready when <em>you</em> are.
          </h1>
          <p className="mb-7 text-[15px] leading-relaxed text-ink/75">
            I ask one question at a time — you answer <span className="text-ink">out loud</span>.
            I grade against real study notes, correct what you missed, and adapt the difficulty.
            Miss a topic and it comes back until you own it.
          </p>

          <div className="mb-8 flex flex-col gap-2.5 text-left">
            {YOU_CAN_SAY.map((s) => (
              <div key={s.phrase} className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/4 px-4 py-2.5">
                <s.icon className="h-4 w-4 shrink-0 text-aurora" aria-hidden />
                <span className="w-32 shrink-0 text-[14px] text-ink">{s.phrase}</span>
                <span className="text-[13px] text-mist">{s.meaning}</span>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={begin}
            disabled={starting}
            className="pill-solid w-full py-3.5 text-[17px] disabled:opacity-60"
          >
            {starting ? 'Waking the coach…' : 'Begin session'}
          </button>
          <p className="mt-4 text-[12px] text-mist">
            Chrome + headphones recommended · mic is requested only now, on your click
          </p>
          {error && <p className="mt-4 text-[14px] text-ember">{ERROR_COPY[error]}</p>}
        </div>
      </main>
    )
  }

  /* ---------------------------------------------------------------- */
  /* Live session                                                      */
  /* ---------------------------------------------------------------- */
  return (
    <main className="relative flex h-screen flex-col overflow-hidden">
      {/* Topic + difficulty chip */}
      {assignment && (
        <div className="glass absolute right-5 top-20 z-10 flex items-center gap-2.5 px-4 py-2 sm:right-8">
          <span className="text-[13px] text-ink">{assignment.label}</span>
          <span className="flex gap-1" aria-label={`level ${assignment.difficulty} of 5`}>
            {[1, 2, 3, 4, 5].map((n) => (
              <span
                key={n}
                className={`h-1.5 w-1.5 rounded-full ${n <= assignment.difficulty ? 'bg-aurora' : 'bg-white/15'}`}
              />
            ))}
          </span>
          {assignment.revisit && (
            <span className="rounded-full border border-aurora/40 bg-aurora/10 px-2 py-0.5 text-[11px] text-aurora">
              revisit
            </span>
          )}
        </div>
      )}

      {/* Orb + state, in flow so nothing ever overlaps */}
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center pt-14">
        <div className="relative h-[min(52vmin,420px)] w-[min(52vmin,420px)]">
          <OrbCanvas className="h-full w-full" />
        </div>
        <p className="mt-1 h-5 text-[13px] uppercase tracking-[0.35em] text-mist">
          {STATE_LABEL[status] ?? (mode === 'ptt' ? 'hold to answer' : muted ? 'muted' : 'ready')}
        </p>
      </div>

      {/* Captions */}
      <div className="z-10 mx-auto w-full max-w-2xl px-5 pb-3 text-center">
        {(feedback || question) && (
          <div className="glass px-6 py-4">
            {feedback && status !== 'listening' && (
              <p className="mb-2 text-[14px] leading-relaxed text-mist">
                {lastVerdict === 'n/a' && <span className="text-nebula">✳ </span>}
                {feedback}
              </p>
            )}
            {question && <p className="text-[16px] leading-relaxed text-ink">{question}</p>}
          </div>
        )}
        <div className="mt-3 min-h-[38px]">
          {interim && (
            <span className="glass inline-block max-w-xl px-4 py-2 text-[14px] italic text-aurora">
              “{interim}”
            </span>
          )}
        </div>
        <p className="mt-1 text-[12px] text-mist/80">
          answer out loud · say <span className="text-ink/70">“explain that”</span> for a lesson ·{' '}
          <span className="text-ink/70">“skip”</span> · <span className="text-ink/70">“stop”</span>
        </p>
        {error && <p className="mt-2 text-[13px] text-ember">{ERROR_COPY[error]}</p>}
      </div>

      {/* Controls */}
      <div className="z-10 flex items-center justify-center gap-3 pb-7">
        <div className="glass flex overflow-hidden rounded-full p-1 text-[13px]">
          {(['auto', 'ptt'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => voiceLoop.setMode(m)}
              className={`rounded-full px-4 py-1.5 transition-colors duration-200 ${
                mode === m ? 'bg-ink text-abyss' : 'text-mist'
              }`}
            >
              {m === 'auto' ? 'Auto listen' : 'Push to talk'}
            </button>
          ))}
        </div>

        {mode === 'ptt' && (
          <button
            type="button"
            onPointerDown={() => voiceLoop.pttDown()}
            onPointerUp={() => voiceLoop.pttUp()}
            onPointerLeave={() => voiceLoop.pttUp()}
            className={`flex h-12 w-12 items-center justify-center rounded-full border transition-colors duration-150 ${
              status === 'listening'
                ? 'border-aurora bg-aurora text-abyss'
                : 'glass border-white/15 text-ink'
            }`}
            aria-label="Hold to talk (or hold Space)"
          >
            <Mic className="h-5 w-5" />
          </button>
        )}

        <button
          type="button"
          onClick={() => voiceLoop.toggleMute()}
          className={`flex h-12 w-12 items-center justify-center rounded-full border transition-colors duration-150 ${
            muted ? 'border-ember/60 bg-ember/15 text-ember' : 'glass border-white/15 text-ink'
          }`}
          aria-label={muted ? 'Unmute microphone' : 'Mute microphone'}
          aria-pressed={muted}
        >
          {muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
        </button>

        <button
          type="button"
          onClick={() => {
            voiceLoop.end()
            navigate('/progress')
          }}
          className="pill gap-2 text-[14px]"
        >
          <Square className="h-3.5 w-3.5" /> End session
        </button>
      </div>
    </main>
  )
}
