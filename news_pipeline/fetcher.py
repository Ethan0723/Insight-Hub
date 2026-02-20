"""RSS fetching module (template)."""

from __future__ import annotations

from typing import Any



def fetch_rss_items(feed_urls: list[str]) -> list[dict[str, Any]]:
    """Fetch RSS items from feed URLs.

    Placeholder implementation: returns an empty list.
    Future implementation should parse RSS feeds and normalize fields.
    """

    # TODO: Implement feed fetching with feedparser.
    _ = feed_urls
    return []
