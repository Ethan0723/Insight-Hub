"""News processing logic: deduplicate and write into news_raw table."""

from __future__ import annotations

import hashlib
from typing import Any
from datetime import datetime
from email.utils import parsedate_to_datetime

from .supabase_client import get_news_by_hash, insert_news_raw


TARGET_YEAR = 2025


def generate_content_hash(title: str, url: str, content: str) -> str:
    """Generate md5 hash based on title + url + content."""
    base = f"{title.strip()}|{url.strip()}|{content.strip()}"
    return hashlib.md5(base.encode("utf-8")).hexdigest()


def parse_publish_time(raw_time: str | None) -> datetime | None:
    """Parse RSS publish time safely."""
    if not raw_time:
        return None

    try:
        return parsedate_to_datetime(raw_time)
    except Exception:
        return None


def is_target_year(dt: datetime | None) -> bool:
    """Check whether publish time is in or after target year."""
    if not dt:
        return False
    return dt.year >= TARGET_YEAR


def process_news_items(items: list[dict[str, Any]]) -> dict[str, int]:
    inserted_count = 0
    skipped_count = 0
    filtered_count = 0
    error_count = 0

    for item in items:
        try:
            title = item.get("title", "")
            content = item.get("content", "")
            url = item.get("url", "")

            publish_time_raw = item.get("publish_time")
            publish_time = parse_publish_time(publish_time_raw)

            # 🔹 只处理 2025 年及以后
            if not is_target_year(publish_time):
                filtered_count += 1
                continue

            content_hash = generate_content_hash(title, url, content)

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
                "publish_time": publish_time,
                "content_hash": content_hash,
            }

            insert_news_raw(payload)
            inserted_count += 1
            print(f"[NEW] Inserted | hash={content_hash} | title={title}")

        except Exception as exc:
            error_count += 1
            print(f"[ERROR] title={item.get('title', '')} | error={exc}")

    return {
        "inserted": inserted_count,
        "skipped": skipped_count,
        "filtered": filtered_count,
        "errors": error_count,
    }
