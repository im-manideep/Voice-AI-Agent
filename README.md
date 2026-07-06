# Recall ✳ — study out loud

A **voice AI study coach** for AI/LLM-engineering interview prep. It quizzes
you out loud, listens to your spoken answer, grades it against real study
notes, corrects you with the actual fact you missed, and adapts difficulty —
voice in, voice out, no typing.

**Runs 100% free**: Web Speech API (STT + TTS in the browser) + a local Ollama
model. No API keys needed on Tier 1.

## The loop

```
🎤 you speak → Web Speech STT → FastAPI coach (KB + deterministic scheduler)
             → strict-JSON reply → speechSynthesis TTS → 🔊 you hear → repeat
```

- The **spaced-repetition scheduler is deterministic code** (`backend/tools/scheduler.py`,
  unit-tested) — the LLM words the coaching but *never* picks the topic or difficulty.
- Miss a topic → it returns within **3 questions** (flagged `revisit`).
- Two corrects in a row → difficulty climbs (1–5).
- Grading is done against `backend/kb/` notes retrieved with BM25 — the coach
  cites the fact you missed, it doesn't invent.

## Quick start

Prereqs: [uv](https://docs.astral.sh/uv/), Node 20+, [Ollama](https://ollama.com)
with `ollama pull llama3.2:3b`.

```bash
# 1. backend  (port 8010 — 8000 is used by another local project)
cd backend
uv sync
uv run uvicorn main:app --reload --port 8010

# 2. frontend (port 5183)
cd frontend
npm install
npm run dev        # if npm chokes on the space in the path: node node_modules/vite/bin/vite.js
```

Open **http://localhost:5183** in **Chrome** (desktop), click *Start a
session*, allow the mic, and answer out loud.

> **Chrome-first:** Web Speech recognition is Chrome's (server-backed — needs
> internet). Other browsers degrade politely with an explanation.
> **Headphones recommended:** barge-in (interrupting the coach mid-sentence)
> detects your voice on the mic; echo cancellation handles speakers, but
> headphones make it flawless.

## Verify it works

```bash
cd backend
uv run pytest -q                                  # 34 tests: scheduler, KB, parsing
uv run python scripts/prove_session.py            # scripted 5-turn scheduler proof
uv run python scripts/prove_session.py --live     # same, graded by the real LLM
```

(The scripted proof needs the server running with `RECALL_ALLOW_FORCE_VERDICT=1`.)

## Voice tiers

| Stage | Tier 1 (free, active) | Tier 2 (paid, stubbed — off) |
|---|---|---|
| STT | Web Speech API (browser) | Streamed Whisper via `POST /stt` proxy |
| TTS | speechSynthesis (browser) | Cartesia / ElevenLabs via `GET /tts` proxy |
| LLM | Ollama `llama3.2:3b` | OpenAI `gpt-4o-mini` |

Switch via `backend/.env` (`VOICE_TIER`, `LLM_PROVIDER`) — no code changes.
Keys live server-side only and never reach the browser. `.env` is gitignored.
Note: llama3.2:3b grades strictly and can be noisy; `LLM_PROVIDER=openai`
gives noticeably fairer grading if you ever enable Tier 2.

## Project structure

```
backend/
  main.py               # /session, /turn, /progress, /health (+ Tier-2 stubs)
  agents/coach.py       # LLM coach — strict-JSON contract, defensive parse + retry
  tools/scheduler.py    # deterministic spaced-repetition engine (the core)
  tools/kb.py           # markdown ingest + per-topic BM25 retrieval
  tools/llm.py          # provider-swappable model (ollama / openai)
  kb/                   # study notes (8 topics; drop your own in kb/user/)
  topics.json           # the fixed topic list the scheduler tracks
  scripts/prove_session.py  # the acceptance proof
  workflows/            # SOPs: run a session, add content, tune engine, deploy
frontend/
  src/lib/voiceLoop.ts  # speaking→listening→thinking loop + RMS barge-in
  src/lib/speech/       # STT (restart guards) + TTS (sentence-chunked)
  src/components/orb/   # the GLSL audio-reactive orb (+ reduced-motion fallback)
  src/components/       # landing / session / progress screens
```

## The orb

An icosahedron displaced by simplex noise in a vertex shader, driven by live
audio: your mic's RMS while you speak (cool teal), a TTS word-boundary
envelope while the coach speaks (warm violet), a slow breath otherwise.
`prefers-reduced-motion`, missing WebGL, or a canvas crash all fall back to a
static gradient orb — the app stays fully usable.
