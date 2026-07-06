# SOP: Add study content to the KB

1. Drop a markdown file in `backend/kb/` (or `backend/kb/user/` for personal docs).
2. It MUST start with YAML frontmatter naming a topic id from `topics.json`:
   ```
   ---
   topic: rag_eval_metrics
   source: my-notes
   ---
   ```
   Files without a valid topic are skipped with a startup warning — check server logs.
3. New topic? Add `{"id": "...", "label": "..."}` to `topics.json` first. Existing
   sessions keep their old topic set; new sessions pick it up.
4. Restart the backend (KB is built once at startup).
5. Sanity check: `GET /health` shows the chunk count; every topic should have >= 3 chunks
   (`uv run pytest tests/test_kb.py`).
