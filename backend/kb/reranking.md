---
topic: reranking
source: concept-notes
---

# Reranking

## What a reranker is

A reranker is a second-stage model that re-scores a small candidate set of
passages against the query, after a fast first-stage retriever (BM25, dense,
or hybrid) has pulled, say, the top 30–100. First-stage retrieval is optimized
for recall over a large corpus; the reranker is optimized for precision over a
small list. The output is a re-ordered list, from which only the top few
passages (often 3–5) are passed to the LLM.

## Bi-encoders vs cross-encoders

The reason rerankers work is architectural. A bi-encoder (standard embedding
model) encodes the query and the document into vectors independently — the two
texts never see each other, and all interaction is compressed into one vector
comparison. That independence is what makes vector search fast and indexable,
but it loses fine-grained signals. A cross-encoder feeds the query and the
document together through one transformer, so every query token can attend to
every document token; it outputs a single relevance score. Cross-encoders are
substantially more accurate at judging relevance but far too slow to run
against a whole corpus — scoring is a full forward pass per query-document
pair, and nothing can be precomputed or indexed. The retrieve-then-rerank
pipeline is exactly the trade: cheap recall over millions of chunks, expensive
precision over dozens.

## Practical options and placement

Common choices: open-source cross-encoders (the MS MARCO MiniLM family,
BGE-reranker), late-interaction models like ColBERT (a middle ground that
precomputes token-level document embeddings), and hosted APIs such as Cohere
Rerank or Voyage rerankers. LLM-based reranking — prompting a model to score
or order passages — works but is the slowest and least deterministic option.
The reranker sits between retrieval and generation: retrieve wide (top 30–100)
so the right passage is probably somewhere in the pool, rerank to find it,
then send only the top few to the LLM. Reranking also gives a natural
cut-point: passages below a score threshold can be dropped entirely, which
both saves context tokens and reduces the chance the LLM leans on an
irrelevant passage.

## Costs and failure modes

Reranking adds latency — a forward pass per candidate — so candidate-set size
is the main tuning knob; 100 candidates through a cross-encoder can add
hundreds of milliseconds. It cannot recover a passage the first stage never
retrieved: if recall@100 misses the answer, the reranker is rearranging
deck chairs, which is why retrieval recall should be evaluated separately from
reranker precision. Score thresholds tuned on one domain drift on another.
And a subtle one: rerankers judge query-passage relevance, not answerability
or faithfulness — a passage can be on-topic yet not contain the fact needed,
so end-to-end evaluation still matters.

## When it pays off

Reranking usually gives the largest single quality jump per engineering hour
in a RAG stack: it requires no re-indexing, no data changes, and slots in as
one function between retrieve and generate. It matters most when the corpus
has many near-duplicate or topically-close passages, when context budgets are
tight (send 3 great passages instead of 10 mediocre ones), and when hybrid
retrieval alone still returns plausible-but-wrong neighbors.
