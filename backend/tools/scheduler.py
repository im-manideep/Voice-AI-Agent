"""The spaced-repetition / difficulty engine. Pure deterministic code — no LLM.

The LLM is TOLD what to quiz (topic + difficulty + revisit flag); it never
picks the curriculum. All policy lives here, unit-tested in
tests/test_scheduler.py.

Policies (from CLAUDE.md):
- next topic: (1) revisits due after a recent miss, (2) weakest seen topics,
  (3) new topics in topics.json order, (4) longest-unseen topics. Weakest
  first, Leitner-style. Never repeat the previous topic while alternatives
  exist.
- difficulty: per-topic 1-5. Two consecutive corrects -> +1 (streak resets);
  a miss -> -1 and a revisit is scheduled within the next 3 questions.
- mastery: per-topic 0-5. correct -> +1, incorrect -> -1.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field

VERDICTS = ("correct", "partial", "incorrect", "n/a")

MASTERY_MIN, MASTERY_MAX = 0, 5
DIFFICULTY_MIN, DIFFICULTY_MAX = 1, 5
WEAK_MASTERY_THRESHOLD = 2  # topics at or below this are "weak" and re-drilled
REVISIT_WITHIN = 3  # a missed topic must be re-asked within this many questions
STREAK_FOR_LEVEL_UP = 2


@dataclass
class TopicState:
    topic: str
    mastery: int = 0
    difficulty: int = 1
    streak: int = 0
    miss_count: int = 0
    last_seen_turn: int = -1  # question number when last assigned; -1 = never


@dataclass
class Revisit:
    topic: str
    created_turn: int
    must_by: int  # question number by which the topic must be re-asked


@dataclass
class Assignment:
    topic: str
    difficulty: int
    revisit: bool


@dataclass
class SchedulerState:
    topics: dict[str, TopicState]  # insertion order == topics.json order
    turn: int = 0  # number of questions assigned so far
    last_topic: str | None = None
    revisits: list[Revisit] = field(default_factory=list)


def new_state(topic_ids: list[str]) -> SchedulerState:
    return SchedulerState(topics={t: TopicState(topic=t) for t in topic_ids})


def next_assignment(state: SchedulerState) -> Assignment:
    """Pick the next topic. Mutates state: advances the turn counter, marks the
    topic seen, pops a consumed revisit."""
    q = state.turn + 1  # the question number being assigned

    chosen: str | None = None
    revisit_flag = False

    # 1. Forced revisit: deadline reached — even if it repeats the last topic.
    due = [r for r in state.revisits if r.must_by <= q]
    if due:
        earliest = min(due, key=lambda r: r.created_turn)
        chosen, revisit_flag = earliest.topic, True
        state.revisits.remove(earliest)

    # 2. Queued revisit, as long as it doesn't repeat the previous question.
    if chosen is None:
        for r in state.revisits:
            if r.topic != state.last_topic:
                chosen, revisit_flag = r.topic, True
                state.revisits.remove(r)
                break

    # 3. Weakest seen topics (mastery asc, longest-unseen asc).
    if chosen is None:
        weak = [
            t for t in state.topics.values()
            if t.last_seen_turn >= 0
            and t.mastery <= WEAK_MASTERY_THRESHOLD
            and t.topic != state.last_topic
        ]
        if weak:
            chosen = min(weak, key=lambda t: (t.mastery, t.last_seen_turn)).topic

    # 4. New topics, in topics.json order.
    if chosen is None:
        for t in state.topics.values():
            if t.last_seen_turn < 0:
                chosen = t.topic
                break

    # 5. Stale seen topics, longest-unseen first.
    if chosen is None:
        stale = [
            t for t in state.topics.values()
            if t.last_seen_turn >= 0 and t.topic != state.last_topic
        ]
        if stale:
            chosen = min(stale, key=lambda t: t.last_seen_turn).topic

    # 6. Only one topic in play: repeat it; consume its revisit if one exists.
    if chosen is None:
        chosen = state.last_topic
        if chosen is None:
            raise ValueError("scheduler has no topics")
        for r in state.revisits:
            if r.topic == chosen:
                revisit_flag = True
                state.revisits.remove(r)
                break

    topic_state = state.topics[chosen]
    topic_state.last_seen_turn = q
    state.turn = q
    state.last_topic = chosen
    return Assignment(topic=chosen, difficulty=topic_state.difficulty, revisit=revisit_flag)


def record_result(state: SchedulerState, topic: str, verdict: str) -> None:
    if verdict not in VERDICTS:
        raise ValueError(f"unknown verdict: {verdict!r}")
    t = state.topics[topic]

    if verdict == "correct":
        t.streak += 1
        t.mastery = min(MASTERY_MAX, t.mastery + 1)
        if t.streak >= STREAK_FOR_LEVEL_UP:
            t.difficulty = min(DIFFICULTY_MAX, t.difficulty + 1)
            t.streak = 0
        # A correct answer settles the debt — drop any pending revisits.
        state.revisits = [r for r in state.revisits if r.topic != topic]
    elif verdict == "incorrect":
        t.streak = 0
        t.mastery = max(MASTERY_MIN, t.mastery - 1)
        t.difficulty = max(DIFFICULTY_MIN, t.difficulty - 1)
        t.miss_count += 1
        state.revisits.append(
            Revisit(topic=topic, created_turn=state.turn, must_by=state.turn + REVISIT_WITHIN)
        )
    elif verdict == "partial":
        t.streak = 0
    # "n/a" (no answer to grade): no state change.


def to_dict(state: SchedulerState) -> dict:
    return {
        "topics": {k: asdict(v) for k, v in state.topics.items()},
        "turn": state.turn,
        "last_topic": state.last_topic,
        "revisits": [asdict(r) for r in state.revisits],
    }


def from_dict(d: dict) -> SchedulerState:
    return SchedulerState(
        topics={k: TopicState(**v) for k, v in d["topics"].items()},
        turn=d["turn"],
        last_topic=d["last_topic"],
        revisits=[Revisit(**r) for r in d["revisits"]],
    )
