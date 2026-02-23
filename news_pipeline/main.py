from __future__ import annotations

from datetime import datetime, timedelta, timezone

from .ai_client import generate_summary
from .config import load_config
from .fetcher import fetch_rss_items
from .processor import (
    is_low_quality_content,
    is_relevant_news,
    process_news_items,
)
from .supabase_client import (
    delete_news_by_ids,
    fetch_news_raw_for_cleanup,
    get_latest_publish_time,
    get_news_missing_title_zh,
    get_news_without_summary,
    update_summary,
)

RUN_BACKFILL = False
# RUN_BACKFILL = True
RUN_TITLE_ZH_BACKFILL = True
RUN_CLEANUP = False
CLEANUP_DRY_RUN = True
CLEANUP_SCAN_LIMIT = 5000
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


def backfill_missing_title_zh() -> None:
    """Regenerate summary JSON for rows missing `summary.title_zh`."""
    records = get_news_missing_title_zh(limit=2000)
    total = len(records)
    print(f"[TITLE_ZH_BACKFILL] Found {total} records missing summary.title_zh")

    for index, record in enumerate(records, start=1):
        news_id = record.get("id", "")
        title = record.get("title", "")
        content = record.get("content", "")

        try:
            summary = generate_summary(title, content)
            update_summary(news_id, summary)
            print(f"[TITLE_ZH_BACKFILL] {index}/{total} updated | id={news_id} | title={title}")
        except Exception as exc:
            print(f"[TITLE_ZH_BACKFILL-ERROR] {index}/{total} id={news_id} | error={exc}")


def cleanup_irrelevant_news() -> None:
    """Delete existing irrelevant/low-quality rows from news_raw."""
    rows = fetch_news_raw_for_cleanup(limit=CLEANUP_SCAN_LIMIT)
    print(f"[CLEANUP] Scanned rows: {len(rows)}")

    delete_ids: list[str] = []
    for row in rows:
        news_id = str(row.get("id", "")).strip()
        title = str(row.get("title", "")).strip()
        content = str(row.get("content", "")).strip()
        summary = row.get("summary") if isinstance(row.get("summary"), dict) else {}

        reason = None
        if not is_relevant_news(title, content):
            reason = "irrelevant"
        elif is_low_quality_content(title, content):
            reason = "low_quality"
        else:
            tldr = str(summary.get("tldr", "")).strip()
            score = summary.get("impact_score")
            if tldr and "信息不足" in tldr and isinstance(score, (int, float)) and score <= 10:
                reason = "low_confidence"

        if reason and news_id:
            delete_ids.append(news_id)
            print(f"[CLEANUP-MARK] {news_id} | {reason} | {title}")

    print(f"[CLEANUP] Marked for delete: {len(delete_ids)}")
    if CLEANUP_DRY_RUN:
        print("[CLEANUP] Dry run mode, no rows deleted.")
        return

    deleted = delete_news_by_ids(delete_ids)
    print(f"[CLEANUP] Deleted rows: {deleted}")


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
    if RUN_TITLE_ZH_BACKFILL:
        backfill_missing_title_zh()
        return
    if RUN_CLEANUP:
        cleanup_irrelevant_news()
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
