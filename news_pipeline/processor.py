"""News processing logic: deduplicate and write into news_raw table."""

from __future__ import annotations

import hashlib
from datetime import datetime
from typing import Any

from .fetcher import fetch_rss_items
from .supabase_client import get_news_by_hash, insert_news_raw


def generate_content_hash(content: str) -> str:
    normalized = (content or "").strip()
    return hashlib.md5(normalized.encode("utf-8")).hexdigest()


def parse_publish_time(publish_time_str: str | None) -> datetime | None:
    if not publish_time_str:
        return None

    try:
        return datetime.strptime(publish_time_str, "%a, %d %b %Y %H:%M:%S %Z")
    except Exception:
        return None


def is_target_year(dt: datetime | None, target_year: int = 2025) -> bool:
    if not dt:
        return False
    return dt.year >= target_year


def process_news_items(items: list[dict[str, Any]]) -> dict[str, int]:
    inserted_count = 0
    skipped_count = 0
    filtered_count = 0
    error_count = 0

    for item in items:
        try:
            publish_time = parse_publish_time(item.get("publish_time"))

            if not is_target_year(publish_time, 2025):
                filtered_count += 1
                continue

            content_hash = generate_content_hash(item.get("content", ""))
            existed = get_news_by_hash(content_hash)

            if existed:
                skipped_count += 1
                print(f"[SKIP] Existing hash: {content_hash}")
                continue

            payload = {
                "title": item.get("title", ""),
                "content": item.get("content", ""),
                "source": item.get("source", "Google News"),
                "url": item.get("url", ""),
                # 🔥 关键修复在这里
                "publish_time": publish_time.isoformat() if publish_time else None,
                "content_hash": content_hash,
            }

            insert_news_raw(payload)
            inserted_count += 1
            print(f"[NEW] Inserted | title={payload['title']}")

        except Exception as exc:
            error_count += 1
            print(f"[ERROR] title={item.get('title', '')} | error={exc}")

    return {
        "inserted": inserted_count,
        "skipped": skipped_count,
        "filtered": filtered_count,
        "errors": error_count,
    }
