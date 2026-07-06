import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Mic, MicOff, Square } from 'lucide-react'
import { OrbCanvas } from '../orb/OrbCanvas'
import { voiceLoop } from '../../lib/voiceLoop'
import { useSessionStore } from '../../store/sessionStore'
import { useVoiceStore } from '../../store/voiceStore'

const STATE_LABEL: Record<string, string> = {
  listening: 'listening…',
  thinking: 'thinking…',
  speaking: 'speaking…',
}

const ERROR_COPY: Record<string, string> = {
  'mic-denied': 'Microphone access was denied — allow it in the address bar, then try again.',
  unsupported: 'This browser has no Web Speech support. Please use Chrome (desktop).',
  network: 'Connection hiccup — speech recognition needs internet and the backend must be running.',
}

export function SessionScreen() {
  const navigate = useNavigate()
  const { status, mode, muted, interim, error } = useVoiceStore()
  const { sessionId, question, feedback, assignment, over } = useSessionStore()
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

  return (
    <main className="relative flex h-screen flex-col items-center overflow-hidden">
      {/* Topic + difficulty chip */}
      {live && assignment && (
        <div className="glass absolute right-5 top-20 z-10 px-4 py-2 text-[13px] text-ink sm:right-8">
          {assignment.label} · level {assignment.difficulty}
          {assignment.revisit && <span className="text-aurora"> · revisit</span>}
        </div>
      )}

      {/* The orb, center stage */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[86vmin] w-[86vmin] -translate-x-1/2 -translate-y-[56%]">
        <OrbCanvas className="h-full w-full" />
      </div>

      {/* State label under the orb */}
      <div className="absolute left-1/2 top-[68%] -translate-x-1/2 text-center">
        {live && (
          <p className="text-[15px] tracking-[0.25em] text-mist">
            {STATE_LABEL[status] ?? (mode === 'ptt' ? 'hold to answer' : muted ? 'muted' : 'ready')}
          </p>
        )}
      </div>

      {/* Pre-session state */}
      {!live && (
        <div className="relative z-10 flex h-full flex-col items-center justify-center px-6 text-center">
          <h1 className="font-display mb-3 text-5xl text-ink sm:text-6xl">Ready when you are.</h1>
          <p className="mb-8 max-w-md text-mist">
            I'll ask, you answer out loud, I correct and adapt. Your mic is requested only when you
            press start.
          </p>
          <button type="button" onClick={begin} disabled={starting} className="pill-solid px-8 py-3 text-lg">
            {starting ? 'Waking the coach…' : 'Begin session'}
          </button>
          {error && <p className="mt-6 max-w-md text-[14px] text-ember">{ERROR_COPY[error]}</p>}
        </div>
      )}

      {/* Captions */}
      {live && (
        <div className="absolute bottom-32 left-1/2 z-10 w-full max-w-2xl -translate-x-1/2 px-5 text-center">
          {feedback && status !== 'listening' && (
            <p className="mb-2 text-[15px] leading-relaxed text-mist">{feedback}</p>
          )}
          {question && <p className="text-[17px] leading-relaxed text-ink">{question}</p>}
          {interim && (
            <div className="glass mx-auto mt-4 inline-block max-w-xl px-4 py-2">
              <p className="text-[15px] italic text-aurora">“{interim}”</p>
            </div>
          )}
          {error && <p className="mt-3 text-[14px] text-ember">{ERROR_COPY[error]}</p>}
        </div>
      )}

      {/* Controls */}
      {live && (
        <div className="absolute bottom-8 left-1/2 z-10 flex -translate-x-1/2 items-center gap-3">
          {/* Auto / PTT toggle */}
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

          {/* PTT hold button */}
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

          {/* Mute — state always visible */}
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

          {/* End session */}
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
      )}
    </main>
  )
}
