"""Web search/fetch tool implementations."""

from __future__ import annotations

from typing import cast
from urllib.parse import urlparse

import httpx
import trafilatura
from langchain_core.tools import tool
from tavily import AsyncTavilyClient, InvalidAPIKeyError, UsageLimitExceededError

from config import TAVILY_API_KEY
from tools._types import (
    SearchCompactResult,
    SearchResultItem,
    SearchSourceItem,
    TavilySearchResponse,
    WebFetchResponse,
    WebSearchResponse,
)


def _to_web_search_error(
    *,
    query: str,
    summarize: bool,
    topic: str | None,
    message: str,
) -> WebSearchResponse:
    return {
        "status": "error",
        "query": query,
        "summarize": summarize,
        "topic": topic,
        "message": message,
    }


def _normalize_search_results(raw_results: object) -> list[SearchResultItem]:
    if not isinstance(raw_results, list):
        return []

    normalized: list[SearchResultItem] = []
    for item in raw_results:
        if not isinstance(item, dict):
            continue
        score = item.get("score")
        title = item.get("title")
        url = item.get("url")
        content = item.get("content")
        normalized.append({
            "title": title if isinstance(title, str) else "",
            "url": url if isinstance(url, str) else "",
            "content": content if isinstance(content, str) else "",
            "score": float(score) if isinstance(score, (int, float)) else 0.0,
        })
    return normalized


async def _tavily_search(
    query: str,
    max_results: int = 5,
    search_depth: str = "basic",
    include_answer: bool = False,
    topic: str | None = None,
) -> TavilySearchResponse:
    """Helper: call Tavily search API via official SDK."""
    if not TAVILY_API_KEY:
        return {
            "status": "error",
            "results": [],
            "answer": "",
            "message": "TAVILY_API_KEY environment variable not set",
        }

    try:
        client = AsyncTavilyClient(api_key=TAVILY_API_KEY)
        kwargs: dict[str, object] = {
            "query": query,
            "max_results": max_results,
            "search_depth": search_depth,
            "include_answer": include_answer,
        }
        if topic:
            kwargs["topic"] = topic

        data = await client.search(**kwargs)
        data_dict = data if isinstance(data, dict) else {}
        formatted_results = _normalize_search_results(data_dict.get("results"))
        answer = data_dict.get("answer")

        return {
            "status": "success",
            "query": query,
            "answer": answer if isinstance(answer, str) else "",
            "results": formatted_results,
        }
    except InvalidAPIKeyError:
        return {
            "status": "error",
            "results": [],
            "answer": "",
            "message": "Invalid Tavily API key",
        }
    except UsageLimitExceededError:
        return {
            "status": "error",
            "results": [],
            "answer": "",
            "message": "Tavily API usage limit exceeded",
        }
    except Exception as e:
        return {
            "status": "error",
            "results": [],
            "answer": "",
            "message": f"Search failed: {str(e)}",
        }


@tool
async def web_search(
    query: str,
    summarize: bool = False,
    max_results: int = 5,
    topic: str | None = None,
    **kwargs,
) -> WebSearchResponse:
    """
    Unified web search tool.

    Args:
        query: Search query
        summarize: If true, return AI summary + sources; else return compact results
        max_results: Number of results to return
        topic: Optional Tavily topic, e.g. "news", "finance"
    """
    if summarize:
        raw = await _tavily_search(
            query=query,
            max_results=max(5, min(max_results, 10)),
            search_depth="advanced",
            include_answer=True,
            topic=topic,
        )
        if raw["status"] != "success":
            return _to_web_search_error(
                query=query, summarize=True, topic=topic,
                message=raw.get("message", "Search failed"),
            )

        top_results = cast(list[SearchResultItem], raw.get("results", []))[: max(5, min(max_results, 10))]
        sources: list[SearchSourceItem] = [
            {"title": result["title"], "url": result["url"]}
            for result in top_results
        ]
        return {
            "status": "success",
            "query": query,
            "summarize": True,
            "topic": topic,
            "summary": (raw.get("answer") or "").strip(),
            "sources": sources,
            "message": f"Summarized from {len(sources)} sources",
        }

    raw = await _tavily_search(
        query=query,
        max_results=max(1, min(max_results, 10)),
        search_depth="basic",
        include_answer=False,
        topic=topic,
    )
    if raw["status"] != "success":
        return _to_web_search_error(
            query=query, summarize=False, topic=topic,
            message=raw.get("message", "Search failed"),
        )

    results: list[SearchCompactResult] = []
    for result in cast(list[SearchResultItem], raw.get("results", [])):
        snippet = result["content"] or ""
        if len(snippet) > 300:
            snippet = snippet[:300] + "..."
        results.append({
            "title": result["title"],
            "url": result["url"],
            "snippet": snippet,
        })

    return {
        "status": "success",
        "query": query,
        "summarize": False,
        "results": results,
        "message": f"Found {len(results)} results",
    }


@tool
async def web_fetch(url: str, max_chars: int = 16000, **kwargs) -> WebFetchResponse:
    """
    Fetch a URL and convert content to markdown-like text.

    Args:
        url: Target URL
        max_chars: Maximum output characters
    """
    try:
        parsed = urlparse(url)
        if parsed.scheme not in {"http", "https"}:
            return {"status": "error", "url": url, "message": "Only http/https URLs are supported"}

        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            response = await client.get(url)
            response.raise_for_status()

        content_type = (response.headers.get("content-type") or "").lower()
        text = response.text or ""

        if "text/markdown" in content_type or url.lower().endswith(".md"):
            markdown = text
        elif "text/html" in content_type or "<html" in text.lower():
            extracted = trafilatura.extract(
                text,
                include_links=True,
                include_tables=True,
                include_images=True,
                output_format="txt",
            )
            source_line = f"Source: {response.url}"
            markdown = f"{source_line}\n\n{extracted}" if extracted else source_line
        else:
            markdown = text

        markdown = markdown.strip()
        truncated = len(markdown) > max_chars
        if truncated:
            markdown = markdown[:max_chars].rstrip() + "\n\n...[truncated]"

        return {
            "status": "success",
            "url": str(response.url),
            "status_code": response.status_code,
            "content_type": content_type,
            "markdown": markdown,
            "size": len(markdown),
            "truncated": truncated,
            "message": "Fetched and converted URL content",
        }
    except httpx.HTTPStatusError as e:
        return {
            "status": "error",
            "url": url,
            "message": f"Fetch failed with status {e.response.status_code}",
        }
    except Exception as e:
        return {
            "status": "error",
            "url": url,
            "message": f"Fetch failed: {str(e)}",
        }
