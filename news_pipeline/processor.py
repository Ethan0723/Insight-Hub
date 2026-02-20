"""Orchestration logic for the news pipeline (template)."""

from __future__ import annotations

from typing import Any

from .ai_client import summarize_with_claude
from .fetcher import fetch_rss_items
from .supabase_client import upsert_news_record



def run_pipeline(
    feed_urls: list[str],
    claude_api_url: str,
    claude_api_key: str,
    supabase_url: str,
    supabase_service_role_key: str,
) -> dict[str, Any]:
    """Run end-to-end pipeline flow with placeholder behavior.

    Steps:
    1. Fetch RSS items
    2. Summarize each item with AI client
    3. Upsert records to Supabase
    """

    items = fetch_rss_items(feed_urls)
    processed_count = 0

    for item in items:
        summary = summarize_with_claude(item, claude_api_url, claude_api_key)
        success = upsert_news_record(summary, supabase_url, supabase_service_role_key)
        if success:
            processed_count += 1

    return {
        "fetched": len(items),
        "processed": processed_count,
    }
