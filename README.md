# Recall — a Voice AI Study Coach

<img width="1906" height="892" alt="1" src="https://github.com/user-attachments/assets/94cc6b7d-410c-4e3b-8565-a5d5d8e9c9c3" />

<img width="1776" height="865" alt="2" src="https://github.com/user-attachments/assets/efb62343-d4f8-4413-9dbc-2ce85a552a44" />

<img width="1555" height="832" alt="3" src="https://github.com/user-attachments/assets/ade92970-46a1-4d98-a525-e232127037a0" />

<img width="1631" height="742" alt="4" src="https://github.com/user-attachments/assets/70b4bf01-b91e-4910-9f30-65076d05de27" />


Recall is a **voice-first AI study coach** for AI/LLM-engineering interview prep.
You don't type anything: it asks a question out loud, listens to your spoken
answer, grades it against real study notes, tells you exactly what you missed,
and adapts the difficulty as you go.

**It runs 100% free and local** — speech recognition and speech synthesis happen
in the browser (Web Speech API), and the LLM is a local Ollama model. No API
keys are required.

```
🎤 you speak → browser STT → FastAPI backend (scheduler + knowledge base + LLM)
             → graded feedback + next question → browser TTS → 🔊 you hear → repeat
```

---

## What it can do

| You do | It does |
|---|---|
| Answer out loud | Grades you **correct / partial / missed** against study notes and cites the fact you got wrong |
| Miss a question | Brings that topic **back within 3 questions** until you own it |
| Get 2 right in a row on a topic | **Raises the difficulty** (level 1 definitions → level 5 system-design tradeoffs) |
| Say **"explain that"** | Teaches you a mini-lesson from the notes and re-asks — **no penalty** |
| Say **"skip"** | Moves on without grading |
| Say **"stop"** | Ends the session and shows your progress dashboard |
| Talk over the coach | **Barge-in**: it stops speaking immediately and listens |

Quiz topics (8): chunking & hybrid retrieval, reranking, RAG evaluation
metrics, LLM-as-judge pitfalls, agent orchestration & LangGraph, MCP,
provider abstraction, deployment & cost guards.

---

## Tech stack — what, how it's used, and why

### Backend (Python)

| Technology | How it's used here | Why it's the right tool |
|---|---|---|
| **Python 3.12 + [uv](https://docs.astral.sh/uv/)** | Manages the virtualenv and all dependencies (`uv sync`, `uv run`) | uv resolves and installs in seconds and pins everything in `uv.lock`, so the backend is reproducible on any machine with one command |
| **FastAPI** | The API server: `POST /session`, `POST /session/{id}/turn`, `GET /session/{id}/progress`, `GET /health` | Async, tiny boilerplate, automatic request validation via Pydantic — a full typed API in one file (`backend/main.py`) |
| **Pure Python (no framework) — `tools/scheduler.py`** | The **spaced-repetition engine**: per-topic mastery (0–5), difficulty (1–5), streaks, and revisit deadlines. The LLM is *told* what to quiz; it never picks | This is the core design decision: **pedagogy is deterministic code, not LLM output**. It's unit-testable (17 pytest cases), predictable, and can't hallucinate a curriculum |
| **rank_bm25** | Keyword-based retrieval over the study notes: each turn pulls the 3 most relevant note chunks for the current topic, and grading happens *only against those chunks* | At this corpus size (~40 chunks) BM25 matches vector search quality with zero infrastructure — no embeddings, no vector DB, no GPU. It's also why feedback cites real facts instead of inventing them |
| **LangChain (`langchain-ollama` / `langchain-openai`)** | `tools/llm.py` exposes one `complete_json()` function; an env var (`LLM_PROVIDER`) picks Ollama or OpenAI behind it | **Provider abstraction**: dev runs free on a local model, and upgrading to `gpt-4o-mini` is a config change, not a code change. No provider imports leak outside this one file |
| **Ollama (`llama3.2:3b`)** | The default LLM. One call per turn with a strict JSON contract: `{verdict, feedback, next_question, said_stop}` | Free, offline, private. Because 3B models emit broken JSON sometimes, `agents/coach.py` parses defensively: strip code fences → extract the JSON block → coerce enums → one retry → deterministic fallback. **A bad LLM response can never crash a turn** |
| **SQLite** | `sessions.db` stores each session's scheduler state (as JSON) and the full turn history (question, your transcript, verdict, feedback) | Zero-setup persistence that makes sessions resumable and powers the progress dashboard. WAL mode + one connection per request keeps it safe under FastAPI |
| **pytest + httpx** | 35 unit tests (scheduler policies, KB retrieval, JSON parsing) plus `scripts/prove_session.py` — a scripted 5-turn session that asserts a missed topic returns within 3 questions and difficulty rises after a streak | The engine's behavioral guarantees are *proven*, not hoped for. The proof script drives the real HTTP API end-to-end |

### Frontend (TypeScript)

| Technology | How it's used here | Why it's the right tool |
|---|---|---|
| **React 19 + TypeScript + Vite** | The app shell; Vite dev server proxies `/api` → the backend so the browser and server stay same-origin | Instant HMR while iterating on the voice loop; TypeScript catches contract drift between frontend and API types |
| **Web Speech API (`webkitSpeechRecognition`)** | Speech-to-text, streaming interim results into on-screen captions as you talk. Auto-listen mode commits your answer after 1.2s of silence; push-to-talk (hold the button or Space) is one flag away | This is what makes the app **free**: Chrome ships STT. The code handles its quirks — spontaneous disconnects get auto-restarted, and it's server-backed so offline shows a clear error |
| **speechSynthesis (browser TTS)** | Speaks the coach's feedback and next question, **sentence-chunked** into a queue | Also free. Chunking makes speech start faster and dodges Chrome's known ~15s utterance cutoff bug |
| **Web Audio API (`AnalyserNode`)** | A single mic analyser does two jobs: (1) drives the orb's ripples from your live voice, (2) powers **barge-in** — while the coach speaks, sustained mic energy above the ambient baseline cancels TTS and flips to listening | Barge-in *cannot* use speech recognition (it would transcribe the coach through the speakers) — raw RMS energy is the reliable signal. One API, two features |
| **zustand** | Two small stores: the voice state machine (`idle → listening → thinking → speaking`) and the session state (question, feedback, progress) | The voice loop is event-driven chaos (TTS callbacks, STT callbacks, timers); a state machine in a store keeps every component honest about what's happening. Per-frame audio data deliberately bypasses it (a module singleton) so nothing re-renders at 60fps |
| **three.js + @react-three/fiber + drei + postprocessing** | The audio-reactive **orb**: an icosahedron displaced by simplex noise in a GLSL vertex shader, with distinct looks per state (teal ripples when you talk, violet pulse while thinking, warm glow while it talks) + bloom | The orb is the app's face — you can *see* it hearing you. GPU shaders keep it at 60fps; `prefers-reduced-motion`, missing WebGL, or a crash all fall back to a static CSS orb so the app never breaks |
| **Tailwind CSS v4** | All styling, with design tokens (`@theme`) for the cinematic light theme: white background, Instrument Serif display type, Inter body | v4's CSS-first config means the whole design system lives in one CSS file; utilities keep the fast-changing voice UI easy to restyle |
| **motion (framer-motion v12)** | Entrance animations: fade-rise hero, staggered dashboard cards, animated mastery bars | Declarative animations with a built-in `useReducedMotion` guard — every animation has an accessible fallback |

### Architecture decisions worth stealing

1. **Deterministic core, probabilistic edge.** The LLM only *words* the coaching
   (questions, feedback). Topic selection, difficulty, and revisits are plain
   tested Python. This split is why the coach behaves consistently.
2. **Text-in/text-out backend.** On the free tier the browser owns all audio, so
   the API is just JSON — trivial to test with `curl`, and voice quality can be
   upgraded later (tier 2) without touching the core.
3. **Never trust model output.** Strict JSON contract + multi-stage defensive
   parsing + one retry + a deterministic fallback reply. Verified: no turn 500s
   even when the 3B model emits garbage.
4. **Keys stay server-side.** Tier-2 STT/TTS endpoints exist as stubs that proxy
   through the backend, so a paid upgrade never exposes a key to the browser.
   `.env` is gitignored.

---

## Quick start

Prereqs: [uv](https://docs.astral.sh/uv/), Node 20+, [Ollama](https://ollama.com),
then `ollama pull llama3.2:3b`.

```bash
# 1. backend (port 8010)
cd backend
uv sync
uv run uvicorn main:app --reload --port 8010

# 2. frontend (port 5183)
cd frontend
npm install
npm run dev
```

Open **http://localhost:5183** in **Chrome** (desktop), click *Begin session*,
allow the mic, and answer out loud.

> **Chrome-first:** speech recognition is Chrome's Web Speech API (server-backed,
> needs internet). Other browsers show a polite explanation.
> **Headphones recommended** for the cleanest barge-in.

## Verify it yourself

```bash
cd backend
uv run pytest -q                                # 35 tests: scheduler, KB, parsing
uv run python scripts/prove_session.py          # scripted 5-turn scheduler proof
uv run python scripts/prove_session.py --live   # same, graded by the real LLM
```

The proof script asserts the two acceptance guarantees against the running API:
a missed topic returns within 3 questions (flagged `revisit`), and two correct
answers in a row raise the difficulty. It exits non-zero if either fails.
(Run the server with `RECALL_ALLOW_FORCE_VERDICT=1` for the scripted mode.)

## Project structure

```
backend/
  main.py                   # FastAPI routes (+ disabled tier-2 voice stubs)
  agents/coach.py           # LLM coach: strict-JSON contract, defensive parse, explain mode
  tools/scheduler.py        # deterministic spaced-repetition engine (the core)
  tools/kb.py               # markdown ingest + per-topic BM25 retrieval
  tools/llm.py              # provider-swappable LLM (ollama / openai)
  kb/                       # study notes — add your own in kb/user/
  topics.json               # the fixed topic list the scheduler tracks
  scripts/prove_session.py  # end-to-end acceptance proof
  tests/                    # 35 pytest cases
frontend/
  src/lib/voiceLoop.ts      # speaking→listening→thinking loop + RMS barge-in
  src/lib/speech/           # STT (restart guards) + TTS (sentence-chunked queue)
  src/lib/audio/            # mic AnalyserNode + the 60fps audio bus
  src/components/orb/       # GLSL audio-reactive orb + fallbacks
  src/components/           # landing / session / progress screens
```


