from __future__ import annotations

from datetime import datetime, timedelta, timezone

from .ai_client import generate_summary
from .config import load_config
from .fetcher import fetch_rss_items
from .processor import process_news_items
from .supabase_client import get_latest_publish_time, get_news_without_summary, update_summary

RUN_BACKFILL = False
DEFAULT_START = datetime(2026, 1, 1, tzinfo=timezone.utc)
INCREMENTAL_BUFFER_HOURS = 1


def _get_incremental_start_time() -> datetime:
    """Compute incremental fetch start time.

    Uses latest publish_time in DB minus 1 hour buffer to avoid missing late/updated feeds.
    """
    latest = get_latest_publish_time()
    if not latest:
        return DEFAULT_START

    if latest.tzinfo is None:
        latest = latest.replace(tzinfo=timezone.utc)

    return latest - timedelta(hours=INCREMENTAL_BUFFER_HOURS)


def backfill_all_missing_summaries() -> None:
    """Generate and write summaries for all records with null summary."""
    records = get_news_without_summary()
    total = len(records)
    print(f"[BACKFILL] Found {total} records missing summary")

    for index, record in enumerate(records, start=1):
        news_id = record.get("id", "")
        title = record.get("title", "")
        content = record.get("content", "")

        try:
            summary = generate_summary(title, content)
            update_summary(news_id, summary)
            print(f"[BACKFILL] {index}/{total} updated | id={news_id} | title={title}")
        except Exception as exc:
            print(f"[BACKFILL-ERROR] {index}/{total} id={news_id} | error={exc}")


def _run_summary_generation(inserted_records: list[dict[str, str]], enable_summary: bool) -> None:
    """Generate summaries for newly inserted records with graceful network fallback."""
    if not enable_summary:
        print("[SUMMARY] Skipped (ENABLE_SUMMARY=false)")
        return

    for record in inserted_records:
        try:
            summary = generate_summary(record.get("title", ""), record.get("content", ""))
            update_summary(record["id"], summary)
            print(f"[SUMMARY] Updated | id={record['id']} | title={record.get('title', '')}")
        except Exception as exc:
            error_text = str(exc)
            print(f"[SUMMARY-ERROR] id={record.get('id', '')} | error={error_text}")

            # Stop noisy repeated errors when model endpoint DNS/network is unavailable.
            if "Failed to resolve" in error_text or "NameResolutionError" in error_text:
                print("[SUMMARY] Endpoint unreachable, stop summary generation for this run.")
                break


def main() -> None:
    cfg = load_config()

    if RUN_BACKFILL:
        backfill_all_missing_summaries()
        return

    incremental_start = _get_incremental_start_time()
    print(f"[RUN] Incremental fetch since: {incremental_start.isoformat()}")

    print("Fetching RSS...")
    items = fetch_rss_items(min_publish_time=incremental_start)

    print(f"Fetched {len(items)} items")

    result = process_news_items(items)
    _run_summary_generation(result["inserted_records"], cfg.enable_summary)

    print("---- RESULT ----")
    print(result["stats"])


if __name__ == "__main__":
    main()
