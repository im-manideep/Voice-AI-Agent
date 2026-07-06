"""SQLite session persistence. Connection per request, WAL mode, JSON blobs
for scheduler state — resumable sessions with zero ORM."""

from __future__ import annotations

import json
import sqlite3
import uuid
from datetime import datetime, timezone

import config

_SCHEMA = """
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  scheduler_state TEXT NOT NULL,
  current_assignment TEXT,
  current_question TEXT
);
CREATE TABLE IF NOT EXISTS turns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  turn_index INTEGER NOT NULL,
  topic TEXT NOT NULL,
  difficulty INTEGER NOT NULL,
  revisit INTEGER NOT NULL DEFAULT 0,
  question TEXT NOT NULL,
  answer_transcript TEXT,
  verdict TEXT,
  feedback TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_turns_session ON turns(session_id, turn_index);
"""


def init_db() -> None:
    with sqlite3.connect(config.DB_PATH) as conn:
        conn.execute("PRAGMA journal_mode=WAL")
        conn.executescript(_SCHEMA)


def get_conn():
    """FastAPI dependency — one connection per request."""
    conn = sqlite3.connect(config.DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def create_session(conn: sqlite3.Connection, scheduler_state: dict,
                   assignment: dict, question: str) -> str:
    session_id = uuid.uuid4().hex[:12]
    conn.execute(
        "INSERT INTO sessions (id, created_at, status, scheduler_state, current_assignment, current_question)"
        " VALUES (?, ?, 'active', ?, ?, ?)",
        (session_id, _now(), json.dumps(scheduler_state), json.dumps(assignment), question),
    )
    return session_id


def get_session(conn: sqlite3.Connection, session_id: str) -> dict | None:
    row = conn.execute("SELECT * FROM sessions WHERE id = ?", (session_id,)).fetchone()
    if row is None:
        return None
    return {
        "id": row["id"],
        "created_at": row["created_at"],
        "status": row["status"],
        "scheduler_state": json.loads(row["scheduler_state"]),
        "current_assignment": json.loads(row["current_assignment"]) if row["current_assignment"] else None,
        "current_question": row["current_question"],
    }


def update_session(conn: sqlite3.Connection, session_id: str, scheduler_state: dict,
                   assignment: dict | None, question: str | None, status: str) -> None:
    conn.execute(
        "UPDATE sessions SET scheduler_state = ?, current_assignment = ?, current_question = ?, status = ?"
        " WHERE id = ?",
        (json.dumps(scheduler_state),
         json.dumps(assignment) if assignment else None,
         question, status, session_id),
    )


def add_turn(conn: sqlite3.Connection, session_id: str, turn_index: int, topic: str,
             difficulty: int, revisit: bool, question: str, answer: str,
             verdict: str, feedback: str) -> None:
    conn.execute(
        "INSERT INTO turns (session_id, turn_index, topic, difficulty, revisit, question,"
        " answer_transcript, verdict, feedback, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
        (session_id, turn_index, topic, difficulty, int(revisit), question,
         answer, verdict, feedback, _now()),
    )


def get_turns(conn: sqlite3.Connection, session_id: str) -> list[dict]:
    rows = conn.execute(
        "SELECT turn_index, topic, difficulty, revisit, question, answer_transcript,"
        " verdict, feedback, created_at FROM turns WHERE session_id = ? ORDER BY turn_index",
        (session_id,),
    ).fetchall()
    return [
        {
            "turn": r["turn_index"],
            "topic": r["topic"],
            "difficulty": r["difficulty"],
            "revisit": bool(r["revisit"]),
            "question": r["question"],
            "answer": r["answer_transcript"],
            "verdict": r["verdict"],
            "feedback": r["feedback"],
            "created_at": r["created_at"],
        }
        for r in rows
    ]
