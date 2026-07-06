"""Central config. Everything tier/provider-related is env-driven so the
free->pro switch never requires a code change."""

import os
from pathlib import Path

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parent
load_dotenv(BACKEND_DIR / ".env")

LLM_PROVIDER = os.getenv("LLM_PROVIDER", "ollama")  # ollama | openai
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2:3b")
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

VOICE_TIER = os.getenv("VOICE_TIER", "free")  # free | pro

DB_PATH = Path(os.getenv("RECALL_DB_PATH", str(BACKEND_DIR / "sessions.db")))
KB_DIR = BACKEND_DIR / "kb"
TOPICS_PATH = BACKEND_DIR / "topics.json"

# Dev-only escape hatch: lets the scripted proof session skip the LLM grade
# so scheduler behavior can be asserted deterministically.
ALLOW_FORCE_VERDICT = os.getenv("RECALL_ALLOW_FORCE_VERDICT", "0") == "1"
