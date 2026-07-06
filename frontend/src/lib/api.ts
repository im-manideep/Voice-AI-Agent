// Typed client for the Recall backend (proxied via /api -> :8010).

export interface Assignment {
  topic: string
  label: string
  difficulty: number
  revisit: boolean
}

export interface TopicProgress {
  topic: string
  label: string
  mastery: number
  difficulty: number
  streak: number
  miss_count: number
  seen: boolean
}

export interface TurnRow {
  turn: number
  topic: string
  difficulty: number
  revisit: boolean
  question: string
  answer: string | null
  verdict: string | null
  feedback: string | null
  created_at: string
}

export interface Progress {
  status: string
  topics: TopicProgress[]
  history: TurnRow[]
}

export interface SessionCreated {
  session_id: string
  question: string
  assignment: Assignment
  progress: Progress
}

export interface TurnResponse {
  verdict: string
  feedback: string
  next_question: string
  said_stop: boolean
  assignment: Assignment
  progress: Progress
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`${res.status} ${res.statusText}: ${body}`)
  }
  return res.json() as Promise<T>
}

export const api = {
  createSession: () => request<SessionCreated>('/session', { method: 'POST' }),
  takeTurn: (sessionId: string, answer: string) =>
    request<TurnResponse>(`/session/${sessionId}/turn`, {
      method: 'POST',
      body: JSON.stringify({ answer }),
    }),
  getProgress: (sessionId: string) => request<Progress>(`/session/${sessionId}/progress`),
}
