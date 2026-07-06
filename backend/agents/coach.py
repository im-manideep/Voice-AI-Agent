"""The LLM coach. One call per turn, strict JSON contract, defensive parsing.

The scheduler decides WHAT to quiz (topic + difficulty + revisit); this module
only words the coaching. A parse failure never crashes a turn — one retry,
then a deterministic fallback.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass

from tools.kb import KB
from tools.llm import complete_json
from tools.scheduler import Assignment

VERDICTS = {"correct", "partial", "incorrect", "n/a"}

STOP_WORDS_RE = re.compile(
    r"\b(stop|pause|quit|end (the )?session|i'?m done|that'?s enough)\b", re.IGNORECASE
)

DIFFICULTY_RUBRIC = {
    1: "definition recall — ask them to define or state the core concept",
    2: "mechanics — ask them to explain how it works, step by step",
    3: "compare/apply — ask about tradeoffs between approaches or when to use which",
    4: "debugging — describe a misbehaving system and ask what went wrong and why",
    5: "design tradeoffs — an open-ended 'what breaks when / how would you design' question",
}

FALLBACK_QUESTION = {
    1: "In one or two sentences, define {label} and say why it matters.",
    2: "Walk me through how {label} works, step by step.",
    3: "Compare two approaches within {label} — when would you pick each?",
    4: "A system using {label} is misbehaving in production. What's the first failure mode you'd suspect, and why?",
    5: "Design question: what breaks first when you scale up {label}, and how would you guard against it?",
}

SYSTEM_PROMPT = """You are Recall, a friendly, sharp voice tutor for AI/LLM engineering interviews. \
Your words are SPOKEN aloud by text-to-speech, so keep them short and natural.

Rules:
- Grade the student's answer ONLY against the reference passages provided. Correct them with the actual fact from the passages; NEVER invent facts.
- The answer is a speech transcript: ignore transcription noise, filler words, and missing punctuation. Grade the ideas.
- verdict: "correct" (got the key idea), "partial" (some of it, missed something important), "incorrect" (wrong or 'I don't know'), "n/a" (nothing to grade).
- feedback: 2-4 short spoken sentences. Be specific: say what was right and cite the key fact they missed, taken from the passages.
- next_question: exactly ONE question, 1-2 sentences, on the assigned topic at the assigned difficulty. Never ask two questions at once.
- Difficulty scale: 1 = definition recall, 2 = explain the mechanics, 3 = compare and apply tradeoffs, 4 = debug a failure case, 5 = design tradeoffs and "what breaks when".
- If the student asks to stop, pause, or end the session, set said_stop to true.

Reply with ONLY a JSON object, no other text, exactly these keys:
{"verdict": "correct|partial|incorrect|n/a", "feedback": "...", "next_question": "...", "said_stop": false}"""


@dataclass
class CoachReply:
    verdict: str
    feedback: str
    next_question: str
    said_stop: bool


def _extract_json_block(raw: str) -> str | None:
    """Return the first balanced {...} block, tolerating surrounding prose."""
    start = raw.find("{")
    if start == -1:
        return None
    depth = 0
    in_str = False
    escape = False
    for i in range(start, len(raw)):
        ch = raw[i]
        if in_str:
            if escape:
                escape = False
            elif ch == "\\":
                escape = True
            elif ch == '"':
                in_str = False
        elif ch == '"':
            in_str = True
        elif ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return raw[start : i + 1]
    return None


def _coerce_verdict(value: object, answer: str) -> str:
    v = str(value).strip().lower()
    if v in VERDICTS:
        return v
    if "incorrect" in v or "wrong" in v:
        return "incorrect"
    if "partial" in v:
        return "partial"
    if "correct" in v:
        return "correct"
    return "partial" if answer.strip() else "n/a"


def parse_coach_json(raw: str, answer: str = "") -> CoachReply | None:
    """Defensive parse of the model output. Pure function — unit-tested."""
    text = raw.strip()
    # Strip markdown code fences.
    text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text, flags=re.MULTILINE).strip()

    data = None
    try:
        data = json.loads(text)
    except (json.JSONDecodeError, ValueError):
        block = _extract_json_block(text)
        if block:
            try:
                data = json.loads(block)
            except (json.JSONDecodeError, ValueError):
                return None
    if not isinstance(data, dict):
        return None

    feedback = str(data.get("feedback", "")).strip()
    next_question = str(data.get("next_question", "")).strip()
    if not feedback or not next_question:
        return None

    said_stop = data.get("said_stop", None)
    if not isinstance(said_stop, bool):
        said_stop = bool(STOP_WORDS_RE.search(answer))

    return CoachReply(
        verdict=_coerce_verdict(data.get("verdict"), answer),
        feedback=feedback,
        next_question=next_question,
        said_stop=said_stop or bool(STOP_WORDS_RE.search(answer)),
    )


def _passages_block(kb: KB, topic: str, query: str, k: int = 3) -> str:
    chunks = kb.passages_for(topic, query=query, k=k)
    return "\n\n".join(f"[{i + 1}] {c.text}" for i, c in enumerate(chunks))


def _build_user_prompt(
    kb: KB,
    prev: Assignment | None,
    prev_question: str | None,
    answer: str,
    nxt: Assignment,
    history: list[dict],
) -> str:
    nxt_label = kb.topic_label(nxt.topic)
    parts: list[str] = []

    if prev is not None and prev_question:
        prev_label = kb.topic_label(prev.topic)
        parts.append(
            "GRADING TASK\n"
            f'You asked (topic "{prev_label}", difficulty {prev.difficulty}): "{prev_question}"\n'
            "Reference passages to grade against:\n"
            f"{_passages_block(kb, prev.topic, prev_question)}\n"
            f'Student\'s transcribed answer: "{answer.strip() or "(silence)"}"'
        )
    else:
        parts.append(
            "FIRST TURN\n"
            "There is no answer to grade: set verdict to \"n/a\" and make feedback a one-line "
            "welcome (you are Recall, a voice study coach for AI engineering interviews)."
        )

    revisit_note = (
        "\nThis is a REVISIT of a topic they recently missed — approach the same idea from a "
        "different angle; do not repeat an earlier question verbatim."
        if nxt.revisit
        else ""
    )
    parts.append(
        "NEXT QUESTION TASK\n"
        f'Ask ONE question on topic "{nxt_label}" at difficulty {nxt.difficulty} '
        f"({DIFFICULTY_RUBRIC[nxt.difficulty]}).{revisit_note}\n"
        "Base it on these passages:\n"
        f"{_passages_block(kb, nxt.topic, nxt_label)}"
    )

    if history:
        lines = [
            f'- Q ({h["topic"]}): "{h["question"]}" — they answered: '
            f'"{(h.get("answer") or "")[:160]}" — verdict: {h.get("verdict")}'
            for h in history[-4:]
        ]
        parts.append("RECENT HISTORY (avoid repeating these questions)\n" + "\n".join(lines))

    return "\n\n".join(parts)


def fallback_reply(kb: KB, nxt: Assignment, answer: str) -> CoachReply:
    """Deterministic reply when the LLM output is unusable. Never crash a turn."""
    label = kb.topic_label(nxt.topic)
    return CoachReply(
        verdict="n/a",
        feedback="Sorry, I lost my train of thought there — let's keep going.",
        next_question=FALLBACK_QUESTION[nxt.difficulty].format(label=label),
        said_stop=bool(STOP_WORDS_RE.search(answer)),
    )


def run_turn(
    kb: KB,
    prev: Assignment | None,
    prev_question: str | None,
    answer: str,
    nxt: Assignment,
    history: list[dict],
) -> CoachReply:
    user_prompt = _build_user_prompt(kb, prev, prev_question, answer, nxt, history)

    raw = complete_json(SYSTEM_PROMPT, user_prompt)
    reply = parse_coach_json(raw, answer)
    if reply is None:
        # One retry — the Day-3 judge lesson.
        raw = complete_json(
            SYSTEM_PROMPT,
            user_prompt + "\n\nYour previous output was not valid JSON. "
            "Reply with ONLY the JSON object, no prose, no code fences.",
        )
        reply = parse_coach_json(raw, answer)
    if reply is None:
        reply = fallback_reply(kb, nxt, answer)

    # First turn: nothing was graded regardless of what the model claims.
    if prev is None:
        reply.verdict = "n/a"
    return reply
