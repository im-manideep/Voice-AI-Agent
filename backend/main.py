"""Recall API — FastAPI app.

Tier 1 keeps the backend text-in / text-out: the browser does STT/TTS for
free via the Web Speech API. Tier-2 voice proxies (/stt, /tts) exist as
stubs and stay disabled while VOICE_TIER=free.
"""

from __future__ import annotations

import logging
import sqlite3
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

import config
import db
from agents import coach
from schemas import (
    AssignmentOut,
    ProgressOut,
    SessionCreated,
    TopicProgress,
    TurnRequest,
    TurnResponse,
)
from tools import scheduler
from tools.kb import KB
from tools.scheduler import Assignment

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("recall")

kb: KB | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global kb
    db.init_db()
    kb = KB(config.KB_DIR, config.TOPICS_PATH)
    log.info("KB ready: %d chunks across %d topics", len(kb.chunks), len(kb.topic_ids()))
    yield


app = FastAPI(title="Recall", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5183", "http://127.0.0.1:5183"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def _assignment_out(a: Assignment) -> AssignmentOut:
    return AssignmentOut(
        topic=a.topic, label=kb.topic_label(a.topic),
        difficulty=a.difficulty, revisit=a.revisit,
    )


def _progress(state: scheduler.SchedulerState, history: list[dict], status: str) -> ProgressOut:
    return ProgressOut(
        status=status,
        topics=[
            TopicProgress(
                topic=t.topic, label=kb.topic_label(t.topic), mastery=t.mastery,
                difficulty=t.difficulty, streak=t.streak, miss_count=t.miss_count,
                seen=t.last_seen_turn >= 0,
            )
            for t in state.topics.values()
        ],
        history=history,
    )


def _stored_assignment(d: dict) -> Assignment:
    return Assignment(topic=d["topic"], difficulty=d["difficulty"], revisit=d["revisit"])


@app.get("/health")
def health():
    return {
        "status": "ok",
        "voice_tier": config.VOICE_TIER,
        "llm_provider": config.LLM_PROVIDER,
        "model": config.OLLAMA_MODEL if config.LLM_PROVIDER == "ollama" else config.OPENAI_MODEL,
        "kb_chunks": len(kb.chunks) if kb else 0,
    }


@app.post("/session", response_model=SessionCreated)
def create_session(conn: sqlite3.Connection = Depends(db.get_conn)):
    state = scheduler.new_state(kb.topic_ids())
    nxt = scheduler.next_assignment(state)

    reply = coach.run_turn(kb, prev=None, prev_question=None, answer="", nxt=nxt, history=[])

    session_id = db.create_session(
        conn,
        scheduler_state=scheduler.to_dict(state),
        assignment={"topic": nxt.topic, "difficulty": nxt.difficulty, "revisit": nxt.revisit},
        question=reply.next_question,
    )
    return SessionCreated(
        session_id=session_id,
        question=reply.next_question,
        assignment=_assignment_out(nxt),
        progress=_progress(state, [], "active"),
    )


@app.post("/session/{session_id}/turn", response_model=TurnResponse)
def take_turn(session_id: str, req: TurnRequest,
              conn: sqlite3.Connection = Depends(db.get_conn)):
    session = db.get_session(conn, session_id)
    if session is None:
        raise HTTPException(404, "session not found")
    if session["status"] != "active":
        raise HTTPException(409, "session has ended")

    state = scheduler.from_dict(session["scheduler_state"])
    prev = _stored_assignment(session["current_assignment"])
    prev_question = session["current_question"]
    prev_turn_index = state.turn  # question number the user just answered

    # One-question lag: pick the next topic from results through the PREVIOUS
    # turn, then grade this answer. A miss recorded below still returns within
    # 3 questions (see tools/scheduler.py + tests).
    nxt = scheduler.next_assignment(state)

    if req.force_verdict and config.ALLOW_FORCE_VERDICT:
        # Deterministic dev path for the scripted scheduler proof — no LLM.
        reply = coach.fallback_reply(kb, nxt, req.answer)
        reply.verdict = req.force_verdict
        reply.feedback = f"(forced verdict: {req.force_verdict})"
    else:
        history = db.get_turns(conn, session_id)
        reply = coach.run_turn(kb, prev, prev_question, req.answer, nxt, history)

    scheduler.record_result(state, prev.topic, reply.verdict)

    db.add_turn(
        conn, session_id, prev_turn_index, prev.topic, prev.difficulty, prev.revisit,
        prev_question, req.answer, reply.verdict, reply.feedback,
    )

    status = "ended" if reply.said_stop else "active"
    db.update_session(
        conn, session_id,
        scheduler_state=scheduler.to_dict(state),
        assignment={"topic": nxt.topic, "difficulty": nxt.difficulty, "revisit": nxt.revisit},
        question=reply.next_question,
        status=status,
    )

    return TurnResponse(
        verdict=reply.verdict,
        feedback=reply.feedback,
        next_question=reply.next_question,
        said_stop=reply.said_stop,
        assignment=_assignment_out(nxt),
        progress=_progress(state, db.get_turns(conn, session_id), status),
    )


@app.get("/session/{session_id}/progress", response_model=ProgressOut)
def get_progress(session_id: str, conn: sqlite3.Connection = Depends(db.get_conn)):
    session = db.get_session(conn, session_id)
    if session is None:
        raise HTTPException(404, "session not found")
    state = scheduler.from_dict(session["scheduler_state"])
    return _progress(state, db.get_turns(conn, session_id), session["status"])


# ---------------------------------------------------------------------------
# Tier-2 voice proxies — STUBS. Disabled while VOICE_TIER=free.
# Keys stay server-side in .env; audio would be proxied so the browser never
# sees a credential. Do NOT activate without explicit approval (paid APIs).
# ---------------------------------------------------------------------------

@app.post("/stt")
def stt_proxy():
    if config.VOICE_TIER != "pro":
        raise HTTPException(501, "Tier-2 voice is disabled. Set VOICE_TIER=pro to enable.")
    # Pro implementation sketch (not active):
    #   audio chunk (webm/opus) -> OpenAI Whisper streaming transcription
    #   using OPENAI_API_KEY from .env -> {"transcript": ...}
    raise HTTPException(501, "Tier-2 STT proxy not implemented yet.")


@app.get("/tts")
def tts_proxy():
    if config.VOICE_TIER != "pro":
        raise HTTPException(501, "Tier-2 voice is disabled. Set VOICE_TIER=pro to enable.")
    # Pro implementation sketch (not active):
    #   text query param -> Cartesia/ElevenLabs low-latency streaming TTS
    #   (CARTESIA_API_KEY / ELEVENLABS_API_KEY from .env) -> StreamingResponse
    #   of audio chunks, so the key never reaches the browser.
    raise HTTPException(501, "Tier-2 TTS proxy not implemented yet.")
