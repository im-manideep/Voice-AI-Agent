// Tier-1 STT: Chrome's webkitSpeechRecognition with interim results.
//
// Chrome quirks handled here:
// - recognition dies spontaneously (~60s cap, no-speech) -> onend auto-restart
//   with an intentional-stop flag and a 250ms backoff (rapid restarts throw
//   InvalidStateError),
// - it is server-backed: offline -> 'network' error surfaced to the UI.

export interface SttCallbacks {
  onInterim: (text: string) => void
  onCommit: (finalText: string) => void
  onError: (error: 'mic-denied' | 'unsupported' | 'network') => void
}

const SILENCE_COMMIT_MS = 1200
const RESTART_BACKOFF_MS = 250

export function sttSupported(): boolean {
  return !!(window.webkitSpeechRecognition ?? window.SpeechRecognition)
}

export class SttEngine {
  private rec: SpeechRecognitionLike | null = null
  private cb: SttCallbacks
  private wantListening = false
  private autoCommit = false
  private finalBuffer = ''
  private silenceTimer: number | null = null
  private restartTimer: number | null = null

  constructor(cb: SttCallbacks) {
    this.cb = cb
  }

  /** autoCommit: commit after a silence gap (auto mode). PTT commits on stop(). */
  start(autoCommit: boolean): void {
    const Ctor = window.webkitSpeechRecognition ?? window.SpeechRecognition
    if (!Ctor) {
      this.cb.onError('unsupported')
      return
    }
    this.stopTimers()
    this.wantListening = true
    this.autoCommit = autoCommit
    this.finalBuffer = ''

    const rec = new Ctor()
    this.rec = rec
    rec.continuous = true
    rec.interimResults = true
    rec.lang = 'en-US'

    rec.onresult = (ev) => {
      let interim = ''
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const r = ev.results[i]
        if (r.isFinal) {
          this.finalBuffer += r[0].transcript + ' '
          if (this.autoCommit) this.armSilenceTimer()
        } else {
          interim += r[0].transcript
        }
      }
      this.cb.onInterim((this.finalBuffer + interim).trim())
    }

    rec.onerror = (ev) => {
      if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') {
        this.wantListening = false
        this.cb.onError('mic-denied')
      } else if (ev.error === 'network') {
        this.wantListening = false
        this.cb.onError('network')
      }
      // 'no-speech' / 'aborted': onend fires next; the restart guard handles it.
    }

    rec.onend = () => {
      if (!this.wantListening) return
      // Spontaneous end while we still want to listen -> restart with backoff.
      this.restartTimer = window.setTimeout(() => {
        if (!this.wantListening) return
        try {
          rec.start()
        } catch {
          /* InvalidStateError if already restarting — ignore */
        }
      }, RESTART_BACKOFF_MS)
    }

    try {
      rec.start()
    } catch {
      /* already started */
    }
  }

  /** Stop listening. Returns whatever final text was buffered. */
  stop(): string {
    this.wantListening = false
    this.stopTimers()
    const text = this.finalBuffer.trim()
    this.finalBuffer = ''
    try {
      this.rec?.stop()
    } catch {
      /* not started */
    }
    return text
  }

  private armSilenceTimer(): void {
    if (this.silenceTimer) window.clearTimeout(this.silenceTimer)
    this.silenceTimer = window.setTimeout(() => {
      const text = this.stop()
      if (text) this.cb.onCommit(text)
      else this.start(this.autoCommit) // heard nothing usable — keep listening
    }, SILENCE_COMMIT_MS)
  }

  private stopTimers(): void {
    if (this.silenceTimer) window.clearTimeout(this.silenceTimer)
    if (this.restartTimer) window.clearTimeout(this.restartTimer)
    this.silenceTimer = null
    this.restartTimer = null
  }
}
