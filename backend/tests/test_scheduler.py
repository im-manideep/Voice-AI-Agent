"""Unit tests for the deterministic spaced-repetition engine.

These prove the acceptance criteria from CLAUDE.md:
- a missed topic returns (revisit=True) within the next 3 questions,
- two consecutive corrects raise difficulty by 1,
- weakest-first topic selection, clamps, and full determinism.
"""

import json

from tools.scheduler import (
    Assignment,
    Revisit,
    SchedulerState,
    TopicState,
    from_dict,
    new_state,
    next_assignment,
    record_result,
    to_dict,
)

TOPICS = ["a", "b", "c"]


def simulate(state: SchedulerState, verdicts: list[str]) -> list[Assignment]:
    """Assign a question, record the scripted verdict, repeat."""
    out = []
    for v in verdicts:
        a = next_assignment(state)
        record_result(state, a.topic, v)
        out.append(a)
    return out


def test_first_assignment_is_first_topic_in_order():
    a = next_assignment(new_state(TOPICS))
    assert a.topic == "a"
    assert a.difficulty == 1
    assert a.revisit is False


def test_no_immediate_topic_repeat_when_alternatives_exist():
    state = new_state(TOPICS)
    prev = None
    for _ in range(10):
        a = next_assignment(state)
        assert a.topic != prev
        record_result(state, a.topic, "correct")
        prev = a.topic


def test_miss_schedules_revisit_within_3_questions():
    state = new_state(TOPICS)
    first = next_assignment(state)  # q1 = "a"
    record_result(state, first.topic, "incorrect")
    missed_at = state.turn

    for _ in range(3):
        a = next_assignment(state)
        if a.topic == first.topic:
            assert a.revisit is True
            assert state.turn <= missed_at + 3
            return
        record_result(state, a.topic, "correct")
    raise AssertionError("missed topic never returned within 3 questions")


def test_missed_topic_returns_at_second_question_after_miss():
    # Immediately after a miss the same topic is not repeated back-to-back;
    # it returns one interleaved question later.
    state = new_state(TOPICS)
    a1 = next_assignment(state)
    record_result(state, a1.topic, "incorrect")
    a2 = next_assignment(state)
    assert a2.topic != a1.topic
    record_result(state, a2.topic, "correct")
    a3 = next_assignment(state)
    assert a3.topic == a1.topic
    assert a3.revisit is True


def test_forced_revisit_fires_at_deadline_even_repeating_last_topic():
    state = SchedulerState(
        topics={"a": TopicState(topic="a", last_seen_turn=0), "b": TopicState(topic="b")},
        turn=0,
        last_topic="a",
        revisits=[Revisit(topic="a", created_turn=0, must_by=1)],
    )
    a = next_assignment(state)
    assert a.topic == "a"
    assert a.revisit is True
    assert state.revisits == []


def test_two_consecutive_corrects_raise_difficulty():
    state = new_state(["a"])
    record_result(state, "a", "correct")
    assert state.topics["a"].streak == 1
    assert state.topics["a"].difficulty == 1
    record_result(state, "a", "correct")
    assert state.topics["a"].difficulty == 2
    assert state.topics["a"].streak == 0  # streak resets after the level-up


def test_miss_resets_streak_and_lowers_difficulty_and_mastery():
    state = new_state(["a"])
    t = state.topics["a"]
    t.mastery, t.difficulty, t.streak = 3, 3, 1
    record_result(state, "a", "incorrect")
    assert (t.mastery, t.difficulty, t.streak, t.miss_count) == (2, 2, 0, 1)
    assert len(state.revisits) == 1
    assert state.revisits[0].must_by == state.turn + 3


def test_partial_resets_streak_without_revisit_or_mastery_change():
    state = new_state(["a"])
    t = state.topics["a"]
    t.mastery, t.difficulty, t.streak = 2, 2, 1
    record_result(state, "a", "partial")
    assert (t.mastery, t.difficulty, t.streak) == (2, 2, 0)
    assert state.revisits == []


def test_na_changes_nothing():
    state = new_state(["a"])
    before = to_dict(state)
    record_result(state, "a", "n/a")
    assert to_dict(state) == before


def test_difficulty_and_mastery_clamped():
    state = new_state(["a"])
    t = state.topics["a"]
    t.mastery, t.difficulty = 5, 5
    record_result(state, "a", "correct")
    record_result(state, "a", "correct")
    assert (t.mastery, t.difficulty) == (5, 5)
    t.mastery, t.difficulty = 0, 1
    record_result(state, "a", "incorrect")
    assert (t.mastery, t.difficulty) == (0, 1)


def test_correct_answer_clears_pending_revisit_for_topic():
    state = new_state(TOPICS)
    a1 = next_assignment(state)
    record_result(state, a1.topic, "incorrect")
    assert len(state.revisits) == 1
    record_result(state, a1.topic, "correct")
    assert state.revisits == []


def test_weakest_first_ordering():
    state = SchedulerState(
        topics={
            "a": TopicState(topic="a", mastery=4, last_seen_turn=1),
            "b": TopicState(topic="b", mastery=1, last_seen_turn=2),
            "c": TopicState(topic="c", mastery=2, last_seen_turn=3),
        },
        turn=3,
        last_topic="c",
    )
    assert next_assignment(state).topic == "b"


def test_weak_seen_topics_beat_new_topics():
    state = SchedulerState(
        topics={
            "a": TopicState(topic="a", mastery=1, last_seen_turn=1),
            "b": TopicState(topic="b", mastery=3, last_seen_turn=2),
            "new": TopicState(topic="new"),
        },
        turn=2,
        last_topic="b",
    )
    assert next_assignment(state).topic == "a"


def test_assignment_uses_current_topic_difficulty():
    state = new_state(["a", "b"])
    state.topics["a"].difficulty = 4
    assert next_assignment(state).difficulty == 4


def test_golden_10_turn_all_correct_sequence():
    # Hand-traced: weak (mastery<=2) seen topics are re-drilled before new
    # topics enter, so a/b alternate until their mastery clears the threshold,
    # then c joins.
    state = new_state(TOPICS)
    seq = [a.topic for a in simulate(state, ["correct"] * 10)]
    assert seq == ["a", "b", "a", "b", "a", "b", "c", "a", "c", "b"]


def test_simulation_is_deterministic():
    verdicts = ["correct", "incorrect", "correct", "partial", "correct",
                "incorrect", "correct", "correct", "correct", "n/a",
                "correct", "incorrect", "correct", "correct", "correct"]
    run1 = simulate(new_state(TOPICS), verdicts)
    run2 = simulate(new_state(TOPICS), verdicts)
    assert run1 == run2


def test_serialization_roundtrip_preserves_behavior():
    verdicts = ["correct", "incorrect", "correct", "correct"]
    state = new_state(TOPICS)
    simulate(state, verdicts)

    restored = from_dict(json.loads(json.dumps(to_dict(state))))
    tail = ["correct", "incorrect", "correct", "correct", "correct"]
    assert simulate(state, tail) == simulate(restored, tail)
