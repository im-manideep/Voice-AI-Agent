# SOP: Run a study session

1. Start Ollama (`ollama serve` if not running) — model `llama3.2:3b` must be pulled.
2. Backend: `cd backend && uv run uvicorn main:app --reload --port 8010`.
   (Port 8010 — 8000 is often occupied by the Askfirst multi-agent project on
   this machine. The Vite proxy targets 8010.)
3. Frontend: `cd frontend && npm run dev` (fallback: `node node_modules/vite/bin/vite.js`).
4. Open http://localhost:5173 in **Chrome** (Web Speech API), click "Start a session",
   grant mic permission.
5. Headphones recommended — barge-in detection is cleanest without speaker bleed.
6. Verify `/health` reports `{"voice_tier": "free", "llm_provider": "ollama"}` if anything
   seems off.

Failure notes:
- First turn slow → Ollama cold-loading the model (keep_alive=10m mitigates after that).
- STT dead → Chrome's recognition is server-backed; check internet.
