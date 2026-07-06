---
topic: deployment_cost_guards
source: concept-notes
---

# Deployment & Cost Guards

## Why LLM cost is an engineering problem

LLM APIs bill per token, input and output priced separately, and costs scale
with traffic silently — there is no natural backpressure until the invoice
arrives. A deployed LLM feature therefore needs the same discipline as any
metered resource: measurement, budgets, and hard cutoffs. The failure story is
always the same: an unbounded loop, a runaway agent, or a scraped endpoint
burning through a month's budget in an afternoon.

## Measure first: telemetry

Log every LLM call with: model, input tokens, output tokens, latency, caller /
feature tag, and computed cost from a price table. Aggregate per user, per
feature, and per day. Without per-call telemetry, cost work is guessing; with
it, the top few offenders (usually a verbose system prompt duplicated into
every call, or one chatty feature) become obvious. Token counts come free in
every provider's response object — the only work is persisting them.

## The guardrail toolkit

Hard limits: max_tokens on every completion (an unbounded generation is an
unbounded spend), per-user and global daily budgets that return a friendly
"limit reached" instead of calling the API, request timeouts, and iteration
caps on any agent loop. Model routing: send easy or low-stakes traffic to a
cheap small model and reserve the expensive model for hard paths — dev and CI
should default to a local model that costs nothing. Caching: exact-match or
semantic caching of repeated prompts; prompt caching (provider-side) discounts
repeated long prefixes like system prompts and RAG boilerplate. Context
discipline: trim history, cap retrieved passages, and summarize instead of
resending entire transcripts — input tokens are usually the bulk of spend in
RAG systems. Rate limiting at the API gateway stops abuse before it reaches
the model.

## Deployment shape

The non-negotiable: API keys live server-side only — a key shipped to a
browser is a public key. The browser talks to your backend; the backend talks
to the provider, applies auth, rate limits, and budget checks, and streams the
response through. Log at this proxy layer: it is the one choke point every
call passes. Secrets load from environment variables (a gitignored .env
locally, a secret manager in production), and the .gitignore entry must exist
before the first commit — keys that touch git history are compromised keys
and must be rotated.

## Latency and reliability guards

Cost guards pair with reliability guards at the same choke point: retries with
exponential backoff and jitter on 429/5xx (with a retry budget so retries
cannot triple spend), circuit breakers to a degraded mode or fallback model
when the provider is down, streaming so users see tokens immediately instead
of a 10-second blank stare, and graceful degradation messaging when a budget
or rate limit trips. A /health endpoint should report the active provider,
model, and tier so operators can verify at a glance what a deployment is
actually configured to call — the cheapest incident is the one you can
diagnose in one curl.
