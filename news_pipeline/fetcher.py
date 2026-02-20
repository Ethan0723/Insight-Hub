"""RSS fetching module.

Responsible only for fetching and normalizing RSS news items.
"""

from __future__ import annotations

import re
from typing import Any

import certifi
import feedparser
import requests
import trafilatura

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
    """Remove simple HTML tags from text."""
    return re.sub(r"<.*?>", "", text)


def _normalize_text(text: str) -> str:
    """Normalize whitespace and casing for safer text comparison."""
    if not text:
        return ""
    return re.sub(r"\s+", " ", text).strip().lower()


def _looks_like_title(candidate: str, title: str) -> bool:
    """Return True when candidate is effectively just the title text."""
    c = _normalize_text(candidate)
    t = _normalize_text(title)
    if not c or not t:
        return False
    if c == t:
        return True
    if c.startswith(t) and len(c) <= len(t) + 20:
        return True
    return False


def _is_usable_article_text(candidate: str, title: str) -> bool:
    """Heuristic to ensure extracted full text is not a title-only stub."""
    if not candidate:
        return False
    if _looks_like_title(candidate, title):
        return False
    return len(candidate.strip()) >= 180


def _select_best_content(
    title: str,
    full_content: str | None,
    summary: str,
    description: str,
) -> str:
    """Pick best content candidate with strict fallback guards."""
    if full_content and _is_usable_article_text(full_content, title):
        return full_content.strip()

    if summary and not _looks_like_title(summary, title):
        return summary.strip()
    if description and not _looks_like_title(description, title):
        return description.strip()

    merged = " ".join(
        part.strip()
        for part in [summary, description]
        if part and not _looks_like_title(part, title)
    ).strip()
    return merged


def extract_full_content(url: str) -> str | None:
    """Fetch and extract full webpage content from a URL.

    Returns extracted plain text, or None on failure.
    """
    if not url:
        return None

    try:
        response = requests.get(
            url,
            timeout=10,
            verify=certifi.where(),
            headers={"User-Agent": "Insight-Hub-News-Pipeline/1.0"},
        )
        if response.status_code != 200:
            return None

        extracted = trafilatura.extract(response.text)
        if not extracted:
            return None

        return extracted.strip()
    except Exception:
        return None


def _fetch_rss_entries(url: str) -> list[Any]:
    """Fetch RSS XML via requests+certifi and parse entries with feedparser."""
    try:
        response = requests.get(
            url,
            timeout=15,
            verify=certifi.where(),
            headers={"User-Agent": "Insight-Hub-News-Pipeline/1.0"},
        )
        if response.status_code != 200:
            print(f"[RSS] Non-200 status for {url}: {response.status_code}")
            return []

        parsed = feedparser.parse(response.text)
        entries = getattr(parsed, "entries", []) or []

        # Keep processing when bozo has warnings but entries are available.
        if getattr(parsed, "bozo", False) and not entries:
            print(f"[RSS] Parse error for {url}: {getattr(parsed, 'bozo_exception', 'unknown')}")
            return []

        return entries
    except Exception as exc:
        print(f"[RSS] Request failed for {url}: {exc}")
        return []


def fetch_rss_items(feed_urls: list[str] | None = None) -> list[dict[str, Any]]:
    """Fetch and normalize RSS news items.

    Returns a list of dict with fields:
    - title
    - content (full article text when available; fallback to RSS summary/description)
    - url
    - publish_time
    - source (fixed to "Google News")
    """
    urls = feed_urls or [GOOGLE_NEWS_RSS_URL]
    normalized_items: list[dict[str, Any]] = []

    for url in urls:
        entries = _fetch_rss_entries(url)

        for entry in entries:
            title = getattr(entry, "title", "").strip()
            summary = _clean_html(getattr(entry, "summary", "")).strip()
            description = _clean_html(getattr(entry, "description", "")).strip()
            link = getattr(entry, "link", "")

            # Try full webpage extraction first, fallback to RSS text candidates.
            full_content = extract_full_content(link)
            content = _select_best_content(title, full_content, summary, description)

            # Skip low-quality records where content is still empty/title-only.
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
