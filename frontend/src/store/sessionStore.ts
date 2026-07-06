import { create } from 'zustand'
import { api } from '../lib/api'
import type { Assignment, Progress, TurnResponse } from '../lib/api'

interface SessionState {
  sessionId: string | null
  question: string
  feedback: string
  lastVerdict: string | null
  assignment: Assignment | null
  progress: Progress | null
  over: boolean
  start: () => Promise<string>
  submit: (answer: string) => Promise<TurnResponse>
  end: () => void
  refreshProgress: () => Promise<void>
}

export const useSessionStore = create<SessionState>((set, get) => ({
  sessionId: null,
  question: '',
  feedback: '',
  lastVerdict: null,
  assignment: null,
  progress: null,
  over: false,

  start: async () => {
    const s = await api.createSession()
    set({
      sessionId: s.session_id,
      question: s.question,
      feedback: '',
      lastVerdict: null,
      assignment: s.assignment,
      progress: s.progress,
      over: false,
    })
    return s.question
  },

  submit: async (answer: string) => {
    const sessionId = get().sessionId
    if (!sessionId) throw new Error('no active session')
    const t = await api.takeTurn(sessionId, answer)
    set({
      question: t.next_question,
      feedback: t.feedback,
      lastVerdict: t.verdict,
      assignment: t.assignment,
      progress: t.progress,
      over: t.said_stop,
    })
    return t
  },

  end: () => set({ over: true }),

  refreshProgress: async () => {
    const sessionId = get().sessionId
    if (!sessionId) return
    set({ progress: await api.getProgress(sessionId) })
  },
}))
