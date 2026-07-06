"""Defensive-parse tests for the coach JSON contract. No live LLM."""

from agents.coach import CoachReply, parse_coach_json

GOOD = '{"verdict": "correct", "feedback": "Nice.", "next_question": "What is BM25?", "said_stop": false}'


def test_parses_clean_json():
    r = parse_coach_json(GOOD)
    assert r == CoachReply("correct", "Nice.", "What is BM25?", False)


def test_parses_fenced_json():
    r = parse_coach_json(f"```json\n{GOOD}\n```")
    assert r is not None
    assert r.verdict == "correct"


def test_parses_json_with_surrounding_prose():
    r = parse_coach_json(f"Sure! Here is my grading:\n{GOOD}\nHope that helps!")
    assert r is not None
    assert r.next_question == "What is BM25?"


def test_bad_verdict_coerced_for_nonempty_answer():
    raw = '{"verdict": "mostly right", "feedback": "ok", "next_question": "q?", "said_stop": false}'
    assert parse_coach_json(raw, answer="something").verdict == "partial"


def test_verdict_synonym_coercion():
    raw = '{"verdict": "Incorrect answer", "feedback": "ok", "next_question": "q?", "said_stop": false}'
    assert parse_coach_json(raw, answer="x").verdict == "incorrect"


def test_missing_feedback_is_parse_failure():
    raw = '{"verdict": "correct", "next_question": "q?", "said_stop": false}'
    assert parse_coach_json(raw) is None


def test_missing_question_is_parse_failure():
    raw = '{"verdict": "correct", "feedback": "ok", "said_stop": false}'
    assert parse_coach_json(raw) is None


def test_garbage_is_parse_failure():
    assert parse_coach_json("I think the answer was pretty good overall!") is None


def test_missing_said_stop_falls_back_to_keyword_check():
    raw = '{"verdict": "correct", "feedback": "ok", "next_question": "q?"}'
    assert parse_coach_json(raw, answer="let's stop here please").said_stop is True
    assert parse_coach_json(raw, answer="BM25 ranks by term overlap").said_stop is False


def test_stop_keyword_overrides_model_false():
    r = parse_coach_json(GOOD, answer="I want to end the session now")
    assert r.said_stop is True


def test_nested_braces_in_prose_extracted():
    raw = 'Model says: {"verdict": "partial", "feedback": "see {chunking}", "next_question": "q?", "said_stop": false} done'
    r = parse_coach_json(raw, answer="x")
    assert r is not None
    assert r.feedback == "see {chunking}"
