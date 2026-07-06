# SOP: Tune the spaced-repetition engine

All pedagogy policy lives in `tools/scheduler.py` as named constants:
- `WEAK_MASTERY_THRESHOLD` (default 2) — how weak a topic must be to get re-drilled
  before new topics enter.
- `REVISIT_WITHIN` (default 3) — max questions before a missed topic returns.
- `STREAK_FOR_LEVEL_UP` (default 2) — consecutive corrects to raise difficulty.

Process:
1. Change the constant.
2. `uv run pytest tests/test_scheduler.py` — update golden-sequence tests deliberately,
   never delete them.
3. Re-run the scripted proof: `uv run python scripts/prove_session.py` against a running
   server with `RECALL_ALLOW_FORCE_VERDICT=1`.
4. Never put LLM calls inside the scheduler. The LLM words the coaching; code owns the
   curriculum.
