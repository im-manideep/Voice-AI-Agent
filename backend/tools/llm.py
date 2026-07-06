"""Provider-swappable LLM access. The ONLY module that imports provider SDKs.

Swap providers via LLM_PROVIDER in .env — never a code change.
"""

from __future__ import annotations

from functools import lru_cache

import config


@lru_cache(maxsize=1)
def get_chat_model():
    if config.LLM_PROVIDER == "openai":
        from langchain_openai import ChatOpenAI

        return ChatOpenAI(
            model=config.OPENAI_MODEL,
            temperature=0.3,
            model_kwargs={"response_format": {"type": "json_object"}},
        )

    from langchain_ollama import ChatOllama

    return ChatOllama(
        model=config.OLLAMA_MODEL,
        base_url=config.OLLAMA_BASE_URL,
        # format="json" is Ollama's JSON mode — necessary but not sufficient
        # for a 3B model; the coach still parses defensively.
        format="json",
        temperature=0.3,
        # Explicit num_ctx: Ollama's small default silently truncates long
        # prompts (KB passages + history), the #1 cause of garbage JSON.
        num_ctx=8192,
        num_predict=400,
        # Keep the model warm between turns instead of cold-reloading.
        keep_alive="10m",
    )


def complete_json(system: str, user: str) -> str:
    """One chat completion; returns the raw content string (expected JSON)."""
    model = get_chat_model()
    result = model.invoke([("system", system), ("human", user)])
    return result.content if isinstance(result.content, str) else str(result.content)
