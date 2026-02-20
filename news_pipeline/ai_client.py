"""Claude API client module (template)."""

from __future__ import annotations

from typing import Any



def summarize_with_claude(raw_item: dict[str, Any], api_url: str, api_key: str) -> dict[str, Any]:
    """Generate AI summary for a news item.

    Placeholder implementation: echoes selected fields without calling API.
    Future implementation should call Claude API and return structured output.
    """

    _ = (api_url, api_key)
    return {
        "title": raw_item.get("title", ""),
        "summary": "TODO: Claude summary",
        "tags": [],
    }
