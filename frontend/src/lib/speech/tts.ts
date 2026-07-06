// Tier-1 TTS: speechSynthesis, sentence-chunked.
//
// Chrome quirks handled here:
// - long utterances cut off (~15s) -> split into sentence-sized utterances,
// - engine falls asleep mid-queue -> periodic resume() keep-alive,
// - getVoices() is empty until 'voiceschanged',
// - cancel() can swallow a speak() issued in the same tick -> next speak is
//   queued behind a setTimeout(0).
//
// Tier 1 has no audio stream to analyse, so word-boundary events drive a
// pseudo-amplitude envelope on the audioBus for the orb.

import { audioBus } from '../audio/audioBus'

export interface SpeakCallbacks {
  onStart?: () => void
  onEnd?: () => void // fires once, after the LAST sentence (not on cancel)
}

let voice: SpeechSynthesisVoice | null = null
let keepAlive: number | null = null
let envelopeTimer: number | null = null
let generation = 0 // bumped on every cancel/speak to invalidate stale callbacks

function pickVoice(): void {
  const voices = speechSynthesis.getVoices()
  if (!voices.length) return
  voice =
    voices.find((v) => v.name === 'Google US English') ??
    voices.find((v) => v.lang === 'en-US') ??
    voices.find((v) => v.lang.startsWith('en')) ??
    voices[0]
}

if (typeof speechSynthesis !== 'undefined') {
  pickVoice()
  speechSynthesis.addEventListener('voiceschanged', pickVoice)
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function startEnvelope(): void {
  stopEnvelope()
  // Word boundaries kick the level up; this timer decays it, so the orb
  // pulses with the rhythm of speech.
  envelopeTimer = window.setInterval(() => {
    audioBus.level *= 0.82
  }, 50)
}

function stopEnvelope(): void {
  if (envelopeTimer) window.clearInterval(envelopeTimer)
  envelopeTimer = null
}

export function speak(text: string, cb: SpeakCallbacks = {}): void {
  const gen = ++generation
  speechSynthesis.cancel()

  const sentences = splitSentences(text)
  if (!sentences.length) {
    cb.onEnd?.()
    return
  }

  // cancel() + speak() in the same tick silently drops the utterance in Chrome.
  window.setTimeout(() => {
    if (gen !== generation) return
    let started = false

    keepAlive = window.setInterval(() => speechSynthesis.resume(), 10000)
    startEnvelope()

    sentences.forEach((sentence, i) => {
      const u = new SpeechSynthesisUtterance(sentence)
      if (voice) u.voice = voice
      u.rate = 1.04
      u.pitch = 1.0
      u.onstart = () => {
        if (gen !== generation) return
        if (!started) {
          started = true
          cb.onStart?.()
        }
      }
      u.onboundary = () => {
        if (gen !== generation) return
        audioBus.level = Math.min(1, 0.55 + Math.random() * 0.35)
      }
      if (i === sentences.length - 1) {
        u.onend = () => {
          if (gen !== generation) return
          cleanup()
          cb.onEnd?.()
        }
      }
      speechSynthesis.speak(u)
    })
  }, 0)
}

/** Barge-in entry point: stop speaking NOW. onEnd of the cancelled speech never fires. */
export function cancelSpeech(): void {
  generation++
  cleanup()
  speechSynthesis.cancel()
}

export function ttsSupported(): boolean {
  return typeof speechSynthesis !== 'undefined'
}

function cleanup(): void {
  if (keepAlive) window.clearInterval(keepAlive)
  keepAlive = null
  stopEnvelope()
  audioBus.level = 0
}
