// The Tier-1 voice loop: speaking -> listening -> thinking -> speaking ...
//
// Barge-in is analyser-RMS based, NOT recognition based: running speech
// recognition while the coach talks would transcribe the coach through the
// speakers. Instead, while status === 'speaking' the mic RMS is compared to
// an ambient baseline (calibrated while not listening); sustained energy
// cancels TTS and flips to listening. echoCancellation on the mic stream
// keeps speaker bleed manageable; headphones make it perfect.

import { audioBus } from './audio/audioBus'
import { getRms, initMic, isMicReady, setMicEnabled, stopMic } from './audio/analyser'
import { SttEngine, sttSupported } from './speech/stt'
import { cancelSpeech, speak, ttsSupported } from './speech/tts'
import { useSessionStore } from '../store/sessionStore'
import { useVoiceStore } from '../store/voiceStore'

const BARGE_SUSTAIN_MS = 300
const BARGE_FLOOR = 0.035 // absolute RMS floor so room noise can't barge in

class VoiceLoop {
  private stt: SttEngine
  private rafId: number | null = null
  private ambientRms = 0.01
  private bargeSince: number | null = null
  private active = false

  constructor() {
    this.stt = new SttEngine({
      onInterim: (t) => useVoiceStore.getState().setInterim(t),
      onCommit: (t) => void this.commit(t),
      onError: (e) => {
        useVoiceStore.getState().setError(e)
        useVoiceStore.getState().setStatus('idle')
      },
    })
  }

  supported(): boolean {
    return sttSupported() && ttsSupported()
  }

  /** Entry point — must be called from a user gesture (mic permission). */
  async begin(): Promise<void> {
    const voice = useVoiceStore.getState()
    if (!this.supported()) {
      voice.setError('unsupported')
      return
    }
    try {
      await initMic()
    } catch {
      voice.setError('mic-denied')
      return
    }
    voice.setError(null)
    this.active = true
    this.startMeter()

    const question = await useSessionStore.getState().start()
    this.speakPhase(question)
  }

  end(): void {
    this.active = false
    this.stt.stop()
    cancelSpeech()
    if (this.rafId) cancelAnimationFrame(this.rafId)
    this.rafId = null
    stopMic()
    const voice = useVoiceStore.getState()
    voice.setStatus('idle')
    voice.setInterim('')
    useSessionStore.getState().end()
  }

  // ---- phases ------------------------------------------------------------

  private speakPhase(text: string): void {
    if (!this.active) return
    const voice = useVoiceStore.getState()
    voice.setInterim('')
    voice.setStatus('speaking')
    this.bargeSince = null
    speak(text, {
      onEnd: () => {
        if (!this.active) return
        if (useSessionStore.getState().over) {
          this.end()
          return
        }
        if (useVoiceStore.getState().mode === 'auto' && !useVoiceStore.getState().muted) {
          this.listenPhase()
        } else {
          useVoiceStore.getState().setStatus('idle') // PTT: hold to answer
        }
      },
    })
  }

  private listenPhase(): void {
    if (!this.active) return
    useVoiceStore.getState().setStatus('listening')
    this.stt.start(true)
  }

  private async commit(text: string): Promise<void> {
    if (!this.active) return
    const voice = useVoiceStore.getState()
    voice.setStatus('thinking')
    voice.setInterim(text)
    try {
      const t = await useSessionStore.getState().submit(text)
      this.speakPhase(`${t.feedback} ${t.said_stop ? '' : t.next_question}`.trim())
    } catch {
      voice.setError('network')
      voice.setStatus('idle')
    }
  }

  // ---- push-to-talk ------------------------------------------------------

  pttDown(): void {
    if (!this.active || useVoiceStore.getState().muted) return
    if (useVoiceStore.getState().status === 'speaking') cancelSpeech() // barge-in via button
    useVoiceStore.getState().setStatus('listening')
    this.stt.start(false)
  }

  pttUp(): void {
    if (!this.active) return
    if (useVoiceStore.getState().status !== 'listening') return
    const text = this.stt.stop()
    if (text) void this.commit(text)
    else useVoiceStore.getState().setStatus('idle')
  }

  // ---- controls ----------------------------------------------------------

  setMode(mode: 'auto' | 'ptt'): void {
    const voice = useVoiceStore.getState()
    voice.setMode(mode)
    if (!this.active) return
    if (mode === 'ptt' && voice.status === 'listening') {
      this.stt.stop()
      voice.setStatus('idle')
    } else if (mode === 'auto' && voice.status === 'idle' && !voice.muted) {
      this.listenPhase()
    }
  }

  toggleMute(): void {
    const voice = useVoiceStore.getState()
    const muted = !voice.muted
    voice.setMuted(muted)
    setMicEnabled(!muted)
    if (!this.active) return
    if (muted) {
      if (voice.status === 'listening') this.stt.stop()
      if (voice.status === 'speaking') cancelSpeech()
      voice.setStatus('idle')
    } else if (voice.mode === 'auto') {
      this.listenPhase()
    }
  }

  // ---- the 60fps meter: orb level + barge-in detection ---------------------

  private startMeter(): void {
    if (this.rafId) return
    const tick = () => {
      if (!this.active) return
      const status = useVoiceStore.getState().status
      const rms = isMicReady() ? getRms() : 0
      audioBus.mode = status

      if (status === 'listening') {
        // Map speech RMS (~0.02..0.25) onto 0..1 for the orb.
        const target = Math.min(1, rms * 6)
        audioBus.level += (target - audioBus.level) * 0.35
      } else if (status !== 'speaking') {
        // Calibrate the ambient baseline while nobody should be talking.
        this.ambientRms = this.ambientRms * 0.97 + rms * 0.03
        audioBus.level *= 0.9
      }

      if (status === 'speaking' && useVoiceStore.getState().mode === 'auto') {
        const threshold = Math.max(this.ambientRms * 3.5, BARGE_FLOOR)
        if (rms > threshold && !useVoiceStore.getState().muted) {
          this.bargeSince ??= performance.now()
          if (performance.now() - this.bargeSince > BARGE_SUSTAIN_MS) {
            cancelSpeech()
            this.listenPhase()
          }
        } else {
          this.bargeSince = null
        }
      }

      this.rafId = requestAnimationFrame(tick)
    }
    this.rafId = requestAnimationFrame(tick)
  }
}

export const voiceLoop = new VoiceLoop()
