"""RSS fetching module.

Responsible only for fetching and normalizing RSS news items.
"""

from __future__ import annotations

import re
from datetime import datetime
from email.utils import parsedate_to_datetime
from typing import Any

import certifi
import feedparser
import requests
import trafilatura

from .config import get_default_rss_feeds, load_config

REQUEST_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/121.0.0.0 Safari/537.36"
    ),
    "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
}


def _safe_publish_time(entry: Any) -> str | None:
    """Safely read publish time from an RSS entry."""
    publish_time = getattr(entry, "published", None)
    if publish_time:
        return str(publish_time)

    updated_time = getattr(entry, "updated", None)
    if updated_time:
        return str(updated_time)

    return None


def _parse_publish_time(raw: str | None) -> datetime | None:
    """Parse RSS publish time into datetime."""
    if not raw:
        return None
    try:
        return parsedate_to_datetime(raw)
    except Exception:
        return None


def _clean_html(text: str) -> str:
    """Remove basic HTML tags/entities from text."""
    cleaned = re.sub(r"<.*?>", "", text or "")
    cleaned = cleaned.replace("&nbsp;", " ")
    cleaned = cleaned.replace("\xa0", " ")
    return re.sub(r"\s+", " ", cleaned).strip()


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
    # Reject heavily truncated snippets.
    if candidate.count("...") + candidate.count("…") >= 3:
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


def _extract_source_url(entry: Any) -> str | None:
    """Read source URL from RSS entry when available."""
    source = getattr(entry, "source", None)
    if isinstance(source, dict):
        return source.get("href") or source.get("url")
    if hasattr(source, "get"):
        return source.get("href") or source.get("url")
    return None


def resolve_article_url(rss_link: str, source_url: str | None = None) -> str:
    """Resolve RSS link to a final article URL.

    Google News RSS links often require redirect resolution. For other links, the
    original link itself is usually already the final article URL.
    """
    if not rss_link:
        return source_url or ""

    if "news.google.com" not in rss_link:
        return rss_link

    try:
        response = requests.get(
            rss_link,
            timeout=10,
            allow_redirects=True,
            verify=certifi.where(),
            headers=REQUEST_HEADERS,
        )
        final_url = str(response.url or "").strip()
        if final_url and "news.google.com" not in final_url:
            return final_url
    except Exception:
        pass

    return source_url or rss_link


def extract_full_content(url: str) -> str | None:
    """Fetch and extract full webpage content from a URL."""
    if not url:
        return None

    try:
        response = requests.get(
            url,
            timeout=12,
            verify=certifi.where(),
            headers=REQUEST_HEADERS,
        )
        if response.status_code != 200:
            return None

        extracted = trafilatura.extract(response.text)
        if not extracted:
            return None

        return _clean_html(extracted)
    except Exception:
        return None


def _fetch_rss_entries(url: str) -> list[Any]:
    """Fetch RSS XML and parse entries with resilient fallbacks."""
    try:
        response = requests.get(
            url,
            timeout=15,
            verify=certifi.where(),
            headers=REQUEST_HEADERS,
            allow_redirects=True,
        )
        if response.status_code != 200:
            print(f"[RSS] Non-200 status for {url}: {response.status_code}")
            return []

        # Try bytes first (better encoding handling), then text, then URL direct parse.
        for parser_input in (response.content, response.text, url):
            parsed = feedparser.parse(parser_input)
            entries = getattr(parsed, "entries", []) or []
            if entries:
                return entries

        print(f"[RSS] Parse error for {url}: no entries parsed")
        return []
    except Exception as exc:
        print(f"[RSS] Request failed for {url}: {exc}")
        return []


def fetch_rss_items(
    feed_urls: list[str] | None = None,
    min_publish_time: datetime | None = None,
) -> list[dict[str, Any]]:
    """Fetch and normalize RSS news items from all configured feeds.

    - Supports incremental fetch via min_publish_time.
    - Applies per-feed cap to keep runtime manageable.
    """
    cfg = load_config()

    if feed_urls:
        feeds = [{"name": "Custom Feed", "url": url} for url in feed_urls]
    else:
        feeds = get_default_rss_feeds()

    normalized_items: list[dict[str, Any]] = []

    for feed in feeds:
        feed_name = feed.get("name", "Unknown")
        feed_url = feed.get("url", "")
        entries = _fetch_rss_entries(feed_url)
        if cfg.max_entries_per_feed > 0:
            entries = entries[: cfg.max_entries_per_feed]
        print(f"[RSS] {feed_name}: {len(entries)} entries")

        for entry in entries:
            raw_publish_time = _safe_publish_time(entry)
            publish_dt = _parse_publish_time(raw_publish_time)
            if min_publish_time and publish_dt and publish_dt < min_publish_time:
                continue

            title = _clean_html(getattr(entry, "title", ""))
            summary = _clean_html(getattr(entry, "summary", ""))
            description = _clean_html(getattr(entry, "description", ""))
            rss_link = getattr(entry, "link", "")

            source_url = _extract_source_url(entry)
            article_url = resolve_article_url(rss_link, source_url)
            full_content = extract_full_content(article_url)
            content = _select_best_content(title, full_content, summary, description)

            if not title or not content:
                continue

            normalized_items.append(
                {
                    "title": title,
                    "content": content,
                    "url": rss_link,
                    "publish_time": raw_publish_time,
                    "source": feed_name,
                }
            )

    return normalized_items
