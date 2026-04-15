"""Web search/fetch tools for the agent."""

from .web import web_fetch, web_search

SEARCH_TOOLS = [web_search, web_fetch]

__all__ = ["web_fetch", "web_search", "SEARCH_TOOLS"]
