import { create } from 'zustand'

export type VoiceStatus = 'idle' | 'listening' | 'thinking' | 'speaking'
export type VoiceMode = 'auto' | 'ptt'
export type VoiceError = 'mic-denied' | 'unsupported' | 'network' | null

interface VoiceState {
  status: VoiceStatus
  mode: VoiceMode
  muted: boolean
  interim: string
  error: VoiceError
  setStatus: (s: VoiceStatus) => void
  setMode: (m: VoiceMode) => void
  setMuted: (m: boolean) => void
  setInterim: (t: string) => void
  setError: (e: VoiceError) => void
}

export const useVoiceStore = create<VoiceState>((set) => ({
  status: 'idle',
  mode: 'auto',
  muted: false,
  interim: '',
  error: null,
  setStatus: (status) => set({ status }),
  setMode: (mode) => set({ mode }),
  setMuted: (muted) => set({ muted }),
  setInterim: (interim) => set({ interim }),
  setError: (error) => set({ error }),
}))
