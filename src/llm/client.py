from __future__ import annotations

import os


def get_client():
    """Return a Groq client (falls back to OpenAI if GROQ_API_KEY not set)."""
    groq_key = os.getenv("GROQ_API_KEY")
    if groq_key:
        from groq import Groq
        return Groq(api_key=groq_key)
    from openai import OpenAI
    return OpenAI()


def get_model_name() -> str:
    if os.getenv("GROQ_API_KEY"):
        return os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
    return os.getenv("OPENAI_MODEL", "gpt-4o-mini")


def chat(messages: list[dict], **kwargs) -> str:
    """Send a chat completion and return the response text."""
    client = get_client()
    resp = client.chat.completions.create(
        model=get_model_name(),
        messages=messages,
        **kwargs,
    )
    return resp.choices[0].message.content
