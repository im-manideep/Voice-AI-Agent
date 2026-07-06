---
topic: rag_eval_metrics
source: concept-notes
---

# RAG Evaluation Metrics

## Why RAG needs its own metrics

A RAG answer can fail in two independent places: retrieval fetched the wrong
context, or generation misused good context. A single end-to-end score cannot
tell you which, so RAG evaluation splits into retrieval metrics and generation
metrics — the "RAG triad": is the context relevant to the question, is the
answer grounded in the context, and does the answer actually address the
question.

## Faithfulness (groundedness)

Faithfulness measures whether the generated answer is supported by the
retrieved context — it is the anti-hallucination metric. The standard recipe
(used by frameworks like Ragas): decompose the answer into atomic claims, then
check each claim against the retrieved passages; faithfulness is the fraction
of claims the context supports. An answer can be factually true and still
unfaithful — if the model answered from its own weights rather than the
provided context, you cannot trust the system on content the model does not
know. Low faithfulness with good retrieval points at the prompt or the model;
it is the signal that the generator is freelancing.

## Context precision and context recall

These grade the retriever. Context precision asks: of the passages retrieved,
how many are actually relevant — and are the relevant ones ranked near the
top? Noisy retrieval wastes context budget and gives the model distractors to
latch onto. Context recall asks the mirror question: of the information needed
to produce the reference answer, how much is present somewhere in the
retrieved set? Recall is measured against a ground-truth answer, typically by
checking which claims of the reference answer are attributable to the
retrieved context. Low recall means no generator prompt can save you — the
facts simply are not there; the fix is retrieval-side (chunking, hybrid
search, more candidates, reranking).

## Answer relevance and correctness

Answer relevance checks whether the response addresses the question that was
asked — an answer can be perfectly grounded yet answer a different question.
One recipe: generate synthetic questions from the answer and measure their
embedding similarity to the original question. Answer correctness compares
the answer against a gold reference (claim overlap or judged equivalence) —
it is the closest thing to an end-to-end score but requires labeled data.

## Building an eval set and using the numbers

A useful eval set can be small — 30 to 100 questions with reference answers,
drawn from real usage, including known-hard cases: questions whose answer
spans two documents, questions with near-miss distractor passages, and
questions the corpus cannot answer (where the correct behavior is to say so).
Run the metric suite on every retrieval or prompt change; the split metrics
tell you where the regression lives. The classic diagnosis table: low context
recall → fix retrieval; good recall but low faithfulness → fix the prompt or
model; good faithfulness but low answer relevance → the model is dodging the
question. Metrics computed by an LLM judge inherit that judge's biases, so
spot-check a sample by hand before trusting a number.
