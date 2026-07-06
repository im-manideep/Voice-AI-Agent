// Per-frame audio data flows through this module singleton, NOT zustand —
// the orb reads it inside useFrame at 60fps without re-rendering React.

import type { VoiceStatus } from '../../store/voiceStore'

export const audioBus = {
  /** 0..1 live amplitude: mic RMS while listening, TTS envelope while speaking. */
  level: 0,
  mode: 'idle' as VoiceStatus,
}
