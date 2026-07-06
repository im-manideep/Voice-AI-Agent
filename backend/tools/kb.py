"""Knowledge base: markdown ingest + per-topic BM25 retrieval.

Every KB file declares its topic in YAML frontmatter (deterministic tagging —
no keyword guessing). Chunks are split on `## ` headings, sub-split when long.
Retrieval filters to the requested topic FIRST, then BM25 ranks within that
subset, so a passage can never leak from another topic.
"""

from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass
from pathlib import Path

from rank_bm25 import BM25Okapi

log = logging.getLogger("recall.kb")

MAX_CHUNK_CHARS = 1400
OVERLAP_CHARS = 150

# rank_bm25 does no tokenization of its own; corpus and query MUST go through
# this same function or ranking silently degrades.
_STOPWORDS = frozenset(
    "a an the and or but if then else of to in on for with as by at is are was "
    "were be been it its this that these those from".split()
)


def tokenize(text: str) -> list[str]:
    return [t for t in re.findall(r"[a-z0-9]+", text.lower()) if t not in _STOPWORDS]


@dataclass
class Chunk:
    id: str
    text: str
    source: str
    topic: str
    heading: str


def _parse_frontmatter(raw: str) -> tuple[dict[str, str], str]:
    """Minimal YAML frontmatter parser (key: value lines only)."""
    if not raw.startswith("---"):
        return {}, raw
    parts = raw.split("---", 2)
    if len(parts) < 3:
        return {}, raw
    meta: dict[str, str] = {}
    for line in parts[1].splitlines():
        if ":" in line:
            k, v = line.split(":", 1)
            meta[k.strip()] = v.strip()
    return meta, parts[2]


def _split_long(text: str) -> list[str]:
    """Split an over-long section at paragraph boundaries with a small overlap."""
    if len(text) <= MAX_CHUNK_CHARS:
        return [text]
    pieces: list[str] = []
    current = ""
    for para in text.split("\n\n"):
        if current and len(current) + len(para) + 2 > MAX_CHUNK_CHARS:
            pieces.append(current.strip())
            current = current[-OVERLAP_CHARS:] + "\n\n" + para
        else:
            current = f"{current}\n\n{para}" if current else para
    if current.strip():
        pieces.append(current.strip())
    return pieces


def _chunk_markdown(body: str, source: str, topic: str) -> list[Chunk]:
    chunks: list[Chunk] = []
    # Split on ## headings; the preamble (title line etc.) stays with the first section.
    sections = re.split(r"(?m)^## ", body)
    preamble, rest = sections[0], sections[1:]
    title = ""
    m = re.search(r"(?m)^# (.+)$", preamble)
    if m:
        title = m.group(1).strip()
    for section in rest:
        lines = section.split("\n", 1)
        heading = lines[0].strip()
        content = lines[1].strip() if len(lines) > 1 else ""
        if not content:
            continue
        # Prepend title + heading so each chunk is self-describing.
        full = f"{title} — {heading}\n{content}" if title else f"{heading}\n{content}"
        for i, piece in enumerate(_split_long(full)):
            chunks.append(
                Chunk(
                    id=f"{source}#{heading}#{i}",
                    text=piece,
                    source=source,
                    topic=topic,
                    heading=heading,
                )
            )
    return chunks


class KB:
    def __init__(self, kb_dir: Path, topics_path: Path):
        self._topics: list[dict[str, str]] = json.loads(
            topics_path.read_text(encoding="utf-8")
        )["topics"]
        valid_ids = {t["id"] for t in self._topics}

        self.chunks: list[Chunk] = []
        for path in sorted(kb_dir.rglob("*.md")):
            meta, body = _parse_frontmatter(path.read_text(encoding="utf-8"))
            topic = meta.get("topic", "")
            if topic not in valid_ids:
                if path.name.lower() != "readme.md":
                    log.warning("skipping %s: no valid topic in frontmatter", path.name)
                continue
            source = meta.get("source", path.stem)
            self.chunks.extend(_chunk_markdown(body, source, topic))

        self._by_topic: dict[str, list[Chunk]] = {t["id"]: [] for t in self._topics}
        for c in self.chunks:
            self._by_topic[c.topic].append(c)

        # One BM25 index per topic (tiny corpora; rebuild cost is negligible).
        self._bm25: dict[str, BM25Okapi] = {
            tid: BM25Okapi([tokenize(c.text) for c in cs])
            for tid, cs in self._by_topic.items()
            if cs
        }

    def topic_ids(self) -> list[str]:
        return [t["id"] for t in self._topics]

    def topic_label(self, topic_id: str) -> str:
        for t in self._topics:
            if t["id"] == topic_id:
                return t["label"]
        return topic_id

    def passages_for(self, topic: str, query: str | None = None, k: int = 3) -> list[Chunk]:
        """Top-k chunks for a topic, BM25-ranked by query when one is given."""
        candidates = self._by_topic.get(topic, [])
        if len(candidates) <= k or not query:
            return candidates[:k]
        scores = self._bm25[topic].get_scores(tokenize(query))
        ranked = sorted(zip(scores, range(len(candidates))), key=lambda p: (-p[0], p[1]))
        return [candidates[i] for _, i in ranked[:k]]
