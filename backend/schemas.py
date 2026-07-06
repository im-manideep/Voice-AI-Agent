"""Pydantic request/response models for the API."""

from __future__ import annotations

from pydantic import BaseModel, Field


class TurnRequest(BaseModel):
    answer: str = ""
    # Dev-only (honored when RECALL_ALLOW_FORCE_VERDICT=1): skip the LLM grade
    # so the scripted proof can drive the scheduler deterministically.
    force_verdict: str | None = Field(default=None, pattern="^(correct|partial|incorrect|n/a)$")


class AssignmentOut(BaseModel):
    topic: str
    label: str
    difficulty: int
    revisit: bool


class TopicProgress(BaseModel):
    topic: str
    label: str
    mastery: int
    difficulty: int
    streak: int
    miss_count: int
    seen: bool


class ProgressOut(BaseModel):
    status: str
    topics: list[TopicProgress]
    history: list[dict]


class SessionCreated(BaseModel):
    session_id: str
    question: str
    assignment: AssignmentOut
    progress: ProgressOut


class TurnResponse(BaseModel):
    verdict: str
    feedback: str
    next_question: str
    said_stop: bool
    assignment: AssignmentOut
    progress: ProgressOut
