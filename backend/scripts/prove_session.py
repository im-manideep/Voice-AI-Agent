"""Scripted proof session (BUILD_PROMPT acceptance): drives the live API and
asserts the pedagogy engine works end-to-end.

Default mode uses force_verdict (server must run with
RECALL_ALLOW_FORCE_VERDICT=1) so the trace is fully deterministic:

  Q1 topic A -> correct
  Q2 topic B -> INCORRECT (the miss)
  Q3 topic A -> correct  => A's difficulty must rise 1 -> 2 (2-streak)
  Q4 must be topic B again with revisit=True (within 3 questions of the miss)
  Q5 must be topic A served at difficulty 2

--live mode sends real canned answers through the actual LLM and applies the
conditional assertions (any miss must return within 3 questions).

Usage:
  uv run python scripts/prove_session.py [--live] [--base http://127.0.0.1:8000]
Exits non-zero on any failed assertion.
"""

from __future__ import annotations

import argparse
import sys

import httpx

FAILURES: list[str] = []


def check(cond: bool, msg: str) -> None:
    tag = "PASS" if cond else "FAIL"
    print(f"  [{tag}] {msg}")
    if not cond:
        FAILURES.append(msg)


def show(qnum: int, assignment: dict, verdict: str | None, progress: dict) -> None:
    mastery = {t["topic"]: f'm{t["mastery"]}/d{t["difficulty"]}'
               for t in progress["topics"] if t["seen"]}
    rv = " REVISIT" if assignment["revisit"] else ""
    print(f"Q{qnum}: {assignment['label']} (level {assignment['difficulty']}{rv})"
          + (f"  <- previous verdict: {verdict}" if verdict else ""))
    print(f"     seen topics: {mastery}")


# One decent spoken-style answer per topic for --live mode.
LIVE_ANSWERS = {
    "chunking_hybrid_retrieval": "Chunking splits documents into focused passages so embeddings stay precise, and hybrid retrieval combines BM25 lexical search with dense vector search, merging results with reciprocal rank fusion.",
    "reranking": "A reranker is a cross-encoder that re-scores a small candidate set from the first-stage retriever, since query and document attend to each other it's more accurate but too slow to run over the whole corpus.",
    "rag_eval_metrics": "Faithfulness measures whether the answer's claims are supported by the retrieved context, context precision checks retrieved passages are relevant, and context recall checks the needed information was retrieved at all.",
    "llm_as_judge": "LLM judges have position bias and verbosity bias, so you swap answer order in pairwise comparisons, use concrete rubrics, ask for reasoning before the verdict, and calibrate against human labels.",
    "agent_orchestration": "LangGraph models an app as a graph over shared typed state, with conditional edges deciding the next node, checkpointers persisting state per thread for resumability, and interrupts pausing for human approval.",
    "mcp_basics": "MCP is an open JSON-RPC standard connecting AI apps to tools, with three primitives: model-controlled tools, application-controlled resources, and user-controlled prompts, over stdio or streamable HTTP transports.",
    "provider_abstraction": "You define one interface for completions and select the provider with an environment variable, so swapping between a local Ollama model and a paid API is a config change, not a code change.",
    "deployment_cost_guards": "Keep API keys server-side only, log tokens and cost per call, set max token limits and per-user budgets, cache repeated prompts, and route easy traffic to cheaper models.",
}


def run(base: str, live: bool) -> None:
    client = httpx.Client(base_url=base, timeout=120)

    health = client.get("/health").json()
    print(f"health: {health}\n")

    r = client.post("/session")
    r.raise_for_status()
    s = r.json()
    sid = s["session_id"]
    a1 = s["assignment"]
    show(1, a1, None, s["progress"])
    print(f'     coach asks: "{s["question"]}"\n')

    topic_a = a1["topic"]
    check(a1["difficulty"] == 1, "session starts at difficulty 1")

    def turn(qnum: int, verdict: str, current_topic: str) -> dict:
        if live:
            answer = "Hmm, I don't know that one." if verdict == "incorrect" \
                else LIVE_ANSWERS[current_topic]
            body = {"answer": answer}
        else:
            body = {"answer": f"(scripted {verdict})", "force_verdict": verdict}
        resp = client.post(f"/session/{sid}/turn", json=body)
        resp.raise_for_status()
        data = resp.json()
        show(qnum + 1, data["assignment"], data["verdict"], data["progress"])
        return data

    # Q1 answered correct -> Q2 assigned
    t1 = turn(1, "correct", topic_a)
    topic_b = t1["assignment"]["topic"]
    check(topic_b != topic_a, "Q2 moves to a different topic")

    # Q2 answered INCORRECT (the miss on topic B) -> Q3 assigned
    t2 = turn(2, "incorrect", topic_b)
    if not live:
        check(t2["verdict"] == "incorrect", "forced miss recorded on Q2")
    check(t2["assignment"]["topic"] == topic_a, "Q3 returns to weakest seen topic (A)")

    # Q3 answered correct (A's 2nd correct -> difficulty up) -> Q4 assigned
    t3 = turn(3, "correct", t2["assignment"]["topic"])
    a_prog = next(t for t in t3["progress"]["topics"] if t["topic"] == topic_a)
    if not live:
        check(a_prog["difficulty"] == 2, "two corrects on A raise difficulty 1 -> 2")
    check(t3["assignment"]["topic"] == topic_b, "Q4 is the missed topic B (within 3 questions)")
    check(t3["assignment"]["revisit"] is True, "Q4 is flagged revisit=True")

    # Q4 answered correct -> Q5 assigned
    t4 = turn(4, "correct", t3["assignment"]["topic"])
    if not live:
        check(t4["assignment"]["topic"] == topic_a, "Q5 re-drills A")
        check(t4["assignment"]["difficulty"] == 2, "Q5 serves A at raised difficulty 2")

    # Q5 answered correct — final progress snapshot
    t5 = turn(5, "correct", t4["assignment"]["topic"])

    if live:
        # Conditional guarantee: every miss must have returned within 3 questions.
        prog = client.get(f"/session/{sid}/progress").json()
        history = prog["history"]
        for i, h in enumerate(history):
            if h["verdict"] == "incorrect":
                window = history[i + 1 : i + 4]
                returned = any(w["topic"] == h["topic"] for w in window)
                check(returned or len(window) < 3,
                      f'missed topic "{h["topic"]}" returned within 3 questions')

    print()
    hist = client.get(f"/session/{sid}/progress").json()["history"]
    check(len(hist) == 5, "5 turns recorded in session history")

    if FAILURES:
        print(f"\n{len(FAILURES)} ASSERTION(S) FAILED")
        sys.exit(1)
    print("\nALL ASSERTIONS PASSED — scheduler proof complete.")


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--live", action="store_true", help="grade through the real LLM")
    p.add_argument("--base", default="http://127.0.0.1:8000")
    args = p.parse_args()
    run(args.base, args.live)
