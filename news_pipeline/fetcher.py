"""RSS fetching module.

Responsible only for fetching and normalizing RSS news items.
"""

from __future__ import annotations

import re
from html import unescape
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from typing import Any
from urllib.parse import parse_qs, urlencode, urlparse, urlunparse

import certifi
import feedparser
import requests
import trafilatura
from bs4 import BeautifulSoup

from .config import get_default_rss_feeds, load_config

REQUEST_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/121.0.0.0 Safari/537.36"
    ),
    "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
}

PROMO_NOISE_PHRASES = [
    "sign up",
    "join now",
    "log in",
    "bonus",
    "reward",
    "futures",
    "spot",
    "dex+",
    "event center",
    "market ticker",
    "download app",
    "invite friends",
    "buy crypto",
    "trade now",
    "注册",
    "登录",
    "奖励",
    "注册送",
]


def _build_google_news_windows(
    feed_url: str,
    min_publish_time: datetime | None,
    window_days: int,
    max_windows: int,
) -> list[str]:
    """Split a Google News RSS query into date windows to bypass 100-item cap."""
    if "news.google.com/rss/search" not in feed_url:
        return [feed_url]

    if not min_publish_time:
        return [feed_url]

    now_utc = datetime.now(timezone.utc)
    start = min_publish_time.astimezone(timezone.utc)
    if start > now_utc:
        return [feed_url]

    parsed = urlparse(feed_url)
    params = parse_qs(parsed.query, keep_blank_values=True)
    base_q = (params.get("q", [""])[0] or "").strip()
    if not base_q:
        return [feed_url]

    urls: list[str] = []
    cursor = start
    windows_count = 0
    step = max(1, window_days)

    while cursor < now_utc and windows_count < max_windows:
        end = min(cursor + timedelta(days=step), now_utc + timedelta(days=1))
        after_str = cursor.strftime("%Y-%m-%d")
        before_str = end.strftime("%Y-%m-%d")
        window_q = f"{base_q} after:{after_str} before:{before_str}"

        window_params = dict(params)
        window_params["q"] = [window_q]
        query = urlencode(window_params, doseq=True)
        window_url = urlunparse(
            (parsed.scheme, parsed.netloc, parsed.path, parsed.params, query, parsed.fragment)
        )
        urls.append(window_url)

        cursor = end
        windows_count += 1

    if not urls:
        return [feed_url]
    return urls


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
    cleaned = unescape(cleaned)
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
    if _looks_like_navigation_noise(candidate):
        return False
    # Reject heavily truncated snippets.
    if candidate.count("...") + candidate.count("…") >= 3:
        return False
    return len(candidate.strip()) >= 90


def _is_minimally_usable_text(candidate: str, title: str) -> bool:
    """Softer guard used when no high-quality full text is available."""
    if not candidate:
        return False
    if _looks_like_title(candidate, title):
        return False
    if _looks_like_title_suffix_stub(candidate, title):
        return False
    if _looks_like_navigation_noise(candidate):
        return False
    if candidate.count("...") + candidate.count("…") >= 4:
        return False
    return len(candidate.strip()) >= 140


def _looks_like_title_suffix_stub(candidate: str, title: str) -> bool:
    """Detect patterns like 'Title ... SourceName' that are not article bodies."""
    c = _normalize_text(candidate)
    t = _normalize_text(title)
    if not c or not t:
        return False

    if c.startswith(t):
        suffix = c[len(t) :].strip(" -|:")
        if suffix and len(suffix.split()) <= 8:
            return True
    return False


def _looks_like_navigation_noise(candidate: str) -> bool:
    """Heuristic: detect site nav/menu/cookie blobs extracted as article text."""
    text = _normalize_text(candidate)
    if not text:
        return True

    noisy_phrases = [
        "skip to main content",
        "privacy policy",
        "terms of use",
        "cookie policy",
        "all rights reserved",
        "sign in",
        "log in",
        "subscribe",
        "newsletter",
        "advertisement",
        "menu",
        "home",
        "contact",
        "about us",
        "language",
    ]
    hit_count = sum(1 for phrase in noisy_phrases if phrase in text)
    if hit_count >= 3:
        return True

    # Many short language/menu tokens often means nav extraction.
    language_tokens = [
        "english",
        "français",
        "deutsch",
        "español",
        "русский",
        "日本語",
        "한국어",
        "thai",
        "tiếng việt",
    ]
    lang_hits = sum(1 for token in language_tokens if token in text)
    if lang_hits >= 3:
        return True

    return False


def _promo_noise_hits(text: str) -> int:
    """Count promo/ad phrases in extracted body."""
    lowered = _normalize_text(text)
    if not lowered:
        return 0
    return sum(1 for phrase in PROMO_NOISE_PHRASES if phrase in lowered)


def _score_content_candidate(text: str) -> float:
    """Rank extracted candidates by body-likeness, not only length."""
    if not text:
        return -1e9

    cleaned = text.strip()
    if not cleaned:
        return -1e9

    paragraphs = [p for p in re.split(r"[。\n.!?]+", cleaned) if len(p.strip()) >= 20]
    paragraph_count = len(paragraphs)
    promo_hits = _promo_noise_hits(cleaned)
    ellipsis_count = cleaned.count("...") + cleaned.count("…")
    nav_penalty = 60 if _looks_like_navigation_noise(cleaned) else 0

    # Length still matters, but structure + low-noise matters more.
    score = (
        min(len(cleaned), 4000) / 14.0
        + paragraph_count * 18
        - promo_hits * 45
        - ellipsis_count * 20
        - nav_penalty
    )
    return score


def _pick_best_candidate(candidates: list[str]) -> str | None:
    """Choose candidate with best quality score."""
    scored = [(c, _score_content_candidate(c)) for c in candidates if c]
    if not scored:
        return None
    scored.sort(key=lambda item: item[1], reverse=True)
    return scored[0][0]


def _select_best_content(
    title: str,
    full_content: str | None,
    summary: str,
    description: str,
) -> str:
    """Pick best content candidate with strict fallback guards."""
    if full_content and _is_usable_article_text(full_content, title):
        return full_content.strip()

    # If extraction got some body text but not long enough for strict quality,
    # still prefer it over title-like RSS snippets.
    if full_content and _is_minimally_usable_text(full_content, title):
        return full_content.strip()

    if summary and _is_minimally_usable_text(summary, title):
        return summary.strip()
    if description and _is_minimally_usable_text(description, title):
        return description.strip()

    merged = " ".join(
        part.strip()
        for part in [summary, description]
        if part and _is_minimally_usable_text(part, title)
    ).strip()
    return merged


def _extract_json_ld_article_body(html: str) -> str | None:
    """Try extracting article body from JSON-LD metadata."""
    try:
        soup = BeautifulSoup(html, "html.parser")
        scripts = soup.find_all("script", attrs={"type": "application/ld+json"})
        candidates: list[str] = []
        for script in scripts:
            text = script.string or script.get_text() or ""
            if "articleBody" not in text:
                continue
            matches = re.findall(r'"articleBody"\s*:\s*"(.+?)"', text, flags=re.DOTALL)
            for match in matches:
                cleaned = _clean_html(match.replace('\\"', '"'))
                if cleaned:
                    candidates.append(cleaned)
        if not candidates:
            return None
        candidates.sort(key=len, reverse=True)
        return candidates[0]
    except Exception:
        return None


def _extract_article_blocks(html: str) -> str | None:
    """Fallback extractor based on visible article-like paragraph blocks."""
    try:
        soup = BeautifulSoup(html, "html.parser")
        selectors = [
            ".article-detail__content",
            ".news-detail__content",
            ".news-detail-content",
            ".news-content",
            ".article-body",
            ".article-main",
            ".news-main",
            ".markdown-body",
            "article",
            "[itemprop='articleBody']",
            ".article-content",
            ".post-content",
            ".entry-content",
            ".content-area",
            "main",
        ]

        candidates: list[str] = []
        for selector in selectors:
            for node in soup.select(selector):
                paragraphs = [_clean_html(p.get_text(" ", strip=True)) for p in node.find_all("p")]
                paragraphs = [p for p in paragraphs if len(p) > 40]
                if not paragraphs:
                    continue
                merged = " ".join(paragraphs).strip()
                if merged:
                    candidates.append(merged)
            if candidates:
                break

        if not candidates:
            return None
        return _pick_best_candidate(candidates)
    except Exception:
        return None


def _extract_source_url(entry: Any) -> str | None:
    """Read source URL from RSS entry when available."""
    source = getattr(entry, "source", None)
    if isinstance(source, dict):
        return source.get("href") or source.get("url")
    if hasattr(source, "get"):
        return source.get("href") or source.get("url")
    return None


def _extract_url_from_description(entry: Any) -> str | None:
    """Try to parse canonical article URL from RSS description HTML."""
    raw_description = getattr(entry, "description", "") or getattr(entry, "summary", "")
    if not raw_description:
        return None

    try:
        soup = BeautifulSoup(raw_description, "html.parser")
        for anchor in soup.find_all("a", href=True):
            href = str(anchor["href"]).strip()
            if not href:
                continue
            if href.startswith("http") and "news.google.com" not in href:
                return href
    except Exception:
        return None

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

        html = response.text
        candidates: list[str] = []

        primary = trafilatura.extract(html)
        if primary:
            candidates.append(_clean_html(primary))

        json_ld_body = _extract_json_ld_article_body(html)
        if json_ld_body:
            candidates.append(_clean_html(json_ld_body))

        block_body = _extract_article_blocks(html)
        if block_body:
            candidates.append(_clean_html(block_body))

        candidates = [c for c in candidates if c]
        if not candidates:
            return None

        return _pick_best_candidate(candidates)
    except Exception:
        return None


def recover_full_content(url: str, title: str, current_content: str = "") -> str | None:
    """Try to recover a higher-quality body from the article URL."""
    if not url:
        return None
    target_url = resolve_article_url(url)
    if not target_url:
        return None

    candidate = extract_full_content(target_url)
    if not candidate:
        return None

    cleaned = _clean_html(candidate).strip()
    if not cleaned:
        return None
    if _looks_like_title(cleaned, title) or _looks_like_title_suffix_stub(cleaned, title):
        return None
    if _looks_like_navigation_noise(cleaned):
        return None
    if len(cleaned) < max(140, len((current_content or "").strip()) + 30):
        return None
    return cleaned


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
    seen_keys: set[str] = set()

    for feed in feeds:
        feed_name = feed.get("name", "Unknown")
        feed_url = feed.get("url", "")
        feed_urls_to_fetch = _build_google_news_windows(
            feed_url=feed_url,
            min_publish_time=min_publish_time,
            window_days=cfg.google_window_days,
            max_windows=cfg.max_google_windows,
        )

        total_entries = 0
        for current_url in feed_urls_to_fetch:
            entries = _fetch_rss_entries(current_url)
            if cfg.max_entries_per_feed > 0:
                entries = entries[: cfg.max_entries_per_feed]
            total_entries += len(entries)

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
                description_url = _extract_url_from_description(entry)
                preferred_source_url = description_url or source_url
                article_url = resolve_article_url(rss_link, source_url)
                if not article_url or "news.google.com" in article_url:
                    article_url = preferred_source_url or article_url
                full_content = extract_full_content(article_url)
                content = _select_best_content(title, full_content, summary, description)

                if not title or not content:
                    continue

                # Deduplicate cross-window overlaps.
                dedupe_key = f"{title}|{rss_link}"
                if dedupe_key in seen_keys:
                    continue
                seen_keys.add(dedupe_key)

                normalized_items.append(
                    {
                        "title": title,
                        "content": content,
                        # Persist canonical article URL for downstream recovery / auditing.
                        "url": article_url or preferred_source_url or rss_link,
                        "publish_time": raw_publish_time,
                        "source": feed_name,
                    }
                )

        if len(feed_urls_to_fetch) > 1:
            print(
                f"[RSS] {feed_name}: {total_entries} entries "
                f"across {len(feed_urls_to_fetch)} windows"
            )
        else:
            print(f"[RSS] {feed_name}: {total_entries} entries")

    return normalized_items
