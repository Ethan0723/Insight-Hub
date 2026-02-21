"""News processing logic: deduplicate and write into news_raw table."""

from __future__ import annotations

import hashlib
import re
from datetime import date, datetime, timezone
from email.utils import parsedate_to_datetime
from typing import Any

from .supabase_client import get_news_by_hash, insert_news_raw

TARGET_START_DATE = date(2026, 1, 1)

# Keep relevant cross-border/ecommerce intelligence only.
CROSS_BORDER_KEYWORDS = {
    "cross-border",
    "cross border",
    "crossborder",
    "跨境",
    "跨境电商",
    "international ecommerce",
    "global ecommerce",
    "export",
    "import",
}

ECOMMERCE_KEYWORDS = {
    "ecommerce",
    "e-commerce",
    "retail",
    "marketplace",
    "seller",
    "merchant",
    "独立站",
    "电商",
}

IMPACT_KEYWORDS = {
    "tariff",
    "customs",
    "trade",
    "policy",
    "regulation",
    "vat",
    "tax",
    "compliance",
    "payment",
    "logistics",
    "shipping",
    "fulfillment",
    "gmv",
    "ads",
    "advertising",
    "ai",
    "platform",
    "shopify",
    "amazon",
    "tiktok",
    "temu",
    "shopline",
    "shoplazza",
    "政策",
    "监管",
    "关税",
    "支付",
    "物流",
    "广告",
    "平台",
    "财报",
    "合规",
    "ai",
}


def _normalize_text(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "")).strip().lower()


def _is_low_quality_content(title: str, content: str) -> bool:
    """Block inserts where content is empty or effectively only the title."""
    t = _normalize_text(title)
    c = _normalize_text(content)
    if not c:
        return True
    if c == t:
        return True
    if c.startswith(t) and len(c) <= len(t) + 20:
        return True
    return False


def _contains_any(text: str, keywords: set[str]) -> bool:
    return any(keyword in text for keyword in keywords)


def _is_relevant_news(title: str, content: str) -> bool:
    """Keep cross-border ecommerce or high-impact adjacent intelligence."""
    text = _normalize_text(f"{title} {content}")
    if not text:
        return False

    has_cross_border = _contains_any(text, CROSS_BORDER_KEYWORDS)
    has_ecommerce = _contains_any(text, ECOMMERCE_KEYWORDS)
    has_impact = _contains_any(text, IMPACT_KEYWORDS)

    # Primary: clearly cross-border related.
    if has_cross_border:
        return True

    # Secondary: ecommerce + strategic impact signals.
    if has_ecommerce and has_impact:
        return True

    return False


def generate_content_hash(content: str) -> str:
    """Generate md5 hash for deduplication."""
    normalized = (content or "").strip()
    return hashlib.md5(normalized.encode("utf-8")).hexdigest()


def parse_publish_time(publish_time_str: str | None) -> datetime | None:
    """Parse RSS publish time safely across different feed formats."""
    if not publish_time_str:
        return None

    try:
        dt = parsedate_to_datetime(publish_time_str)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except Exception:
        return None


def is_target_date(dt: datetime | None, start_date: date = TARGET_START_DATE) -> bool:
    """Only process news on/after target date."""
    if not dt:
        return False
    return dt.date() >= start_date


def process_news_items(items: list[dict[str, Any]]) -> dict[str, Any]:
    """Deduplicate and insert raw news records.

    Returns:
    {
      "stats": {"inserted": int, "skipped": int, "filtered": int, "errors": int},
      "inserted_records": [{"id": str, "title": str, "content": str}, ...]
    }
    """

    inserted_count = 0
    skipped_count = 0
    filtered_count = 0
    error_count = 0
    inserted_records: list[dict[str, str]] = []

    for item in items:
        try:
            title = item.get("title", "")
            content = item.get("content", "")
            url = item.get("url", "")

            publish_time = parse_publish_time(item.get("publish_time"))

            if not is_target_date(publish_time, TARGET_START_DATE):
                filtered_count += 1
                continue

            if not _is_relevant_news(title, content):
                filtered_count += 1
                print(f"[FILTER] Irrelevant to cross-border intelligence | title={title}")
                continue

            if _is_low_quality_content(title, content):
                filtered_count += 1
                print(f"[FILTER] Low-quality content skipped | title={title}")
                continue

            content_hash = generate_content_hash(content)
            existed = get_news_by_hash(content_hash)

            if existed:
                skipped_count += 1
                print(f"[SKIP] Existing hash: {content_hash}")
                continue

            payload = {
                "title": title,
                "content": content,
                "source": item.get("source", "Google News"),
                "url": url,
                "publish_time": publish_time.isoformat() if publish_time else None,
                "content_hash": content_hash,
            }

            inserted = insert_news_raw(payload)
            inserted_count += 1
            print(f"[NEW] Inserted | source={payload['source']} | title={title}")

            if inserted.get("id"):
                inserted_records.append(
                    {
                        "id": inserted["id"],
                        "title": inserted.get("title", title),
                        "content": inserted.get("content", content),
                    }
                )

        except Exception as exc:
            error_count += 1
            print(f"[ERROR] title={item.get('title', '')} | error={exc}")

    return {
        "stats": {
            "inserted": inserted_count,
            "skipped": skipped_count,
            "filtered": filtered_count,
            "errors": error_count,
        },
        "inserted_records": inserted_records,
    }
