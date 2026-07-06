# SOP: Deploy / tier switch

Local (free tier, default):
- `VOICE_TIER=free`, `LLM_PROVIDER=ollama` — zero external calls, zero cost.

Switching to Tier 2 (paid — requires explicit user approval first):
1. Set keys in `backend/.env` only (`OPENAI_API_KEY`, `CARTESIA_API_KEY` or
   `ELEVENLABS_API_KEY`). Keys never reach the browser; `/stt` and `/tts` proxy
   through the backend.
2. Set `VOICE_TIER=pro` and/or `LLM_PROVIDER=openai`. No code changes.
3. Restart backend; `/health` must report the new tier/provider.

Checklist before any deploy:
- `.env` is gitignored (`git status` must not show it).
- `uv run pytest` green; `scripts/prove_session.py` passes.
- Frontend build: `cd frontend && npm run build` (fallback `node node_modules/vite/bin/vite.js build`).
