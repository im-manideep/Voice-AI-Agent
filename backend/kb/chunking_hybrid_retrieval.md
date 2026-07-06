---
topic: chunking_hybrid_retrieval
source: concept-notes
---

# Chunking & Hybrid Retrieval

## Why chunking matters

Documents are split into chunks because embedding models and rerankers work
best on focused passages, and because the LLM's context window is a budget you
spend deliberately. Chunks that are too large dilute the embedding — one vector
has to summarize several unrelated ideas, so similarity search gets blurry.
Chunks that are too small lose the surrounding context needed to interpret
them, and retrieval returns fragments that are individually meaningless. Most
production systems land between roughly 200 and 800 tokens per chunk, tuned by
evaluation rather than picked by intuition.

## Chunking strategies

Fixed-size chunking splits every N tokens with an overlap (commonly 10–20%) so
sentences straddling a boundary appear in both neighbors. It is simple and
predictable but ignores document structure. Recursive character splitting
tries separators in order — paragraphs first, then sentences, then words —
keeping natural units intact when it can. Structure-aware chunking splits on
document semantics: markdown headings, code functions, table rows — so each
chunk is a coherent unit, and heading metadata can be prepended to give the
chunk context. Semantic chunking embeds sentences and cuts where the topic
shifts (embedding similarity drops); it produces the most coherent chunks but
costs an embedding pass at ingest time. A key practice regardless of strategy:
store metadata (source file, section heading, position) with each chunk, both
for citation and for filtered retrieval.

## Dense vs sparse retrieval

Dense retrieval embeds the query and chunks into vectors and ranks by cosine
or dot-product similarity. It captures meaning — "how do I make my model
cheaper" can match a passage about quantization — but it can miss exact
strings: product codes, function names, rare acronyms, version numbers.
Sparse (lexical) retrieval such as BM25 scores documents by term overlap,
weighting terms by rarity (inverse document frequency) and normalizing for
document length. BM25 is exact-match strong: identifiers, error messages, and
jargon are where it beats embeddings. Its weakness is vocabulary mismatch — a
query phrased with synonyms scores zero against a passage that never shares
its terms.

## Hybrid retrieval and fusion

Hybrid retrieval runs both dense and sparse search and merges the two ranked
lists, getting semantic recall and exact-match precision at once. The standard
merging method is Reciprocal Rank Fusion (RRF): each document's fused score is
the sum over lists of 1 / (k + rank), with k commonly set to 60. RRF only uses
ranks, not raw scores, which sidesteps the problem that BM25 scores and cosine
similarities live on incomparable scales. An alternative is a weighted linear
combination of normalized scores (an alpha parameter blending dense and
sparse), which is tunable but requires score normalization and careful
evaluation. Hybrid-then-rerank — a wide hybrid retrieval feeding a
cross-encoder reranker — is the pattern most strong RAG systems converge on.

## What breaks in practice

Common failure modes: chunk boundaries that split a definition from its term
(fixed-size without overlap); embedding a whole page and wondering why answers
are vague; ignoring lexical search entirely and failing every query that
contains an exact identifier; and skipping metadata so retrieved chunks cannot
be cited or traced. Retrieval quality should be measured (recall@k on a small
labeled set) before tuning generation — if the right passage never gets
retrieved, no prompt engineering downstream can fix the answer.
