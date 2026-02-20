"""RSS fetching module.

Responsible only for fetching and normalizing RSS news items.
"""

from __future__ import annotations

from typing import Any
import feedparser
import re

GOOGLE_NEWS_RSS_URL = "https://news.google.com/rss/search?q=cross+border+ecommerce"



def _safe_publish_time(entry: Any) -> str | None:
    """Safely read publish time from an RSS entry."""
    publish_time = getattr(entry, "published", None)
    if publish_time:
        return str(publish_time)

    updated_time = getattr(entry, "updated", None)
    if updated_time:
        return str(updated_time)

    return None



def _clean_html(text: str) -> str:
    """Remove simple HTML tags from RSS content."""
    return re.sub(r"<.*?>", "", text)



def fetch_rss_items(feed_urls: list[str] | None = None) -> list[dict[str, Any]]:
    """Fetch and normalize RSS news items.

    Returns a list of dict with fields:
    - title
    - content (summary first, fallback to description)
    - url
    - publish_time
    - source (fixed to "Google News")
    """
    urls = feed_urls or [GOOGLE_NEWS_RSS_URL]
    normalized_items: list[dict[str, Any]] = []

    for url in urls:
        parsed = feedparser.parse(url)

        # Skip invalid/unparseable feeds.
        if getattr(parsed, "bozo", False):
            continue

        for entry in getattr(parsed, "entries", []):
            title = getattr(entry, "title", "").strip()
            summary = getattr(entry, "summary", "")
            description = getattr(entry, "description", "")
            content_raw = summary or description or ""
            content = _clean_html(content_raw).strip()
            link = getattr(entry, "link", "")

            # Basic sanity filter for empty items.
            if not title or not content:
                continue

            normalized_items.append(
                {
                    "title": title,
                    "content": content,
                    "url": link,
                    "publish_time": _safe_publish_time(entry),
                    "source": "Google News",
                }
            )

    return normalized_items
