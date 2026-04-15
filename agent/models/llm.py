"""LLM factory function."""

from typing import Optional

from langchain_openai import ChatOpenAI
from pydantic import SecretStr

from config import LLM_MODEL, OPENAI_API_BASE, OPENAI_API_KEY
from models.deepseek import ChatDeepSeekWithReasoning


def get_llm(model_name: Optional[str] = None):
    """Create and return the base LLM instance.

    Uses ChatDeepSeekWithReasoning for deepseek models (preserves reasoning_content),
    falls back to ChatOpenAI for all other OpenAI-compatible models.
    """
    target_model = model_name or LLM_MODEL
    api_key = SecretStr(OPENAI_API_KEY) if OPENAI_API_KEY else None

    if "deepseek" in target_model.lower():
        if OPENAI_API_BASE:
            return ChatDeepSeekWithReasoning(
                model=target_model,
                api_key=api_key,
                api_base=OPENAI_API_BASE,
                streaming=True,
                stream_usage=True,
            )
        return ChatDeepSeekWithReasoning(
            model=target_model,
            api_key=api_key,
            streaming=True,
            stream_usage=True,
        )

    if OPENAI_API_BASE:
        return ChatOpenAI(
            model=target_model,
            api_key=api_key,
            base_url=OPENAI_API_BASE,
            streaming=True,
            stream_usage=True,
            temperature=0.7,
        )
    return ChatOpenAI(
        model=target_model,
        api_key=api_key,
        streaming=True,
        stream_usage=True,
        temperature=0.7,
    )
