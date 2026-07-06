---
topic: provider_abstraction
source: concept-notes
---

# Provider Abstraction

## The problem it solves

An LLM app hard-wired to one vendor's SDK is one pricing change, outage, or
better-model release away from a rewrite. Provider abstraction inserts one
seam between "the app wants a completion" and "which model produces it", so
swapping openai for a local Ollama model — or routing dev traffic to a free
local model and prod traffic to a paid API — is a configuration change, not a
code change. The same seam is what makes cost control, failover, and
model-quality experiments possible at all.

## The pattern

Define one interface the rest of the codebase calls — as small as
complete(messages) -> text, or a factory like get_chat_model() returning a
common chat interface. Concrete implementations wrap each provider (OpenAI,
Anthropic, Ollama, vLLM), and a config value (environment variable such as
LLM_PROVIDER, never a code constant) selects the implementation at startup.
Libraries like LangChain ship this shape prebuilt — ChatOpenAI and ChatOllama
share the same invoke interface — and gateways like LiteLLM or an
OpenAI-compatible proxy push the seam out of the process entirely. The rule
that keeps the seam clean: no provider-specific imports or parameters outside
the one module that implements the interface.

## What leaks through the abstraction

The interface is easy; the semantics leak. Providers differ in: tokenizers
(the "same" prompt has different token counts, breaking shared truncation
logic), context window sizes, JSON-mode and tool-calling dialects, system
prompt handling, stop sequences, and rate-limit behavior. Local models add
their own: a 3B local model needs shorter prompts, more explicit format
instructions, and more defensive output parsing than a frontier API model —
so "swap the provider" is never truly free, and prompts tuned on one model
must be re-evaluated on another. Good abstractions expose capability flags
(supports_json_mode, max_context) rather than pretending all backends are
identical.

## Dev/prod tiering

A standard cost pattern: local-first development. Dev and CI run against a
free local model (Ollama with a small model like llama3.2:3b) so iteration
costs nothing and works offline; production or demo mode flips
LLM_PROVIDER=openai for a stronger hosted model. The tier switch must live in
config so it never requires touching code, and secrets for the paid tier live
in environment variables loaded from a gitignored .env — keys never appear in
code or reach a browser. The health endpoint should report which provider and
model are active, because "which model am I actually talking to" is the first
debugging question in a tiered setup.

## Testing across providers

Because behavior differs, test the seam: contract tests that run the same
prompt suite against each configured provider and assert structural
properties (parses as JSON, respects the enum, stays under length), plus a
smoke test at startup that fails fast when the configured provider is
unreachable. Pin model versions in config where the provider allows it —
"gpt-4o-mini" today and in three months are different models, and silent
upgrades are a real source of production drift.
