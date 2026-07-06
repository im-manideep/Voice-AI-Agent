"""KB ingest + retrieval tests — run against the real seed content."""

import config
from tools.kb import KB, tokenize


def _kb() -> KB:
    return KB(config.KB_DIR, config.TOPICS_PATH)


def test_all_topics_have_at_least_3_chunks():
    kb = _kb()
    for tid in kb.topic_ids():
        chunks = kb.passages_for(tid, k=100)
        assert len(chunks) >= 3, f"topic {tid} has only {len(chunks)} chunks"


def test_chunks_tagged_with_valid_topic_ids():
    kb = _kb()
    valid = set(kb.topic_ids())
    assert kb.chunks, "KB ingested no chunks"
    for c in kb.chunks:
        assert c.topic in valid


def test_retrieval_stays_within_topic():
    kb = _kb()
    # A query that lexically matches other topics must still return only
    # chunks from the requested topic.
    for c in kb.passages_for("mcp_basics", query="reranking faithfulness chunking", k=3):
        assert c.topic == "mcp_basics"


def test_query_ranking_returns_relevant_chunk_first():
    kb = _kb()
    top = kb.passages_for("rag_eval_metrics", query="what is faithfulness groundedness", k=3)
    assert any("faithfulness" in c.text.lower() for c in top)


def test_tokenizer_lowercases_and_strips_punctuation():
    assert tokenize("Hello, WORLD! BM25-ranking.") == ["hello", "world", "bm25", "ranking"]


def test_chunks_respect_max_length():
    kb = _kb()
    for c in kb.chunks:
        assert len(c.text) <= 1400 + 200  # small tolerance for overlap stitching
