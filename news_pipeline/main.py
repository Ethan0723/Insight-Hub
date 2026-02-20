from .ai_client import generate_summary
from .fetcher import fetch_rss_items
from .processor import process_news_items
from .supabase_client import get_news_without_summary, update_summary

RUN_BACKFILL = False


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
            # Continue processing next records even if one fails.
            print(f"[BACKFILL-ERROR] {index}/{total} id={news_id} | error={exc}")


def main():
    if RUN_BACKFILL:
        backfill_all_missing_summaries()
        return

    print("Fetching RSS...")
    items = fetch_rss_items()

    print(f"Fetched {len(items)} items")

    result = process_news_items(items)

    for record in result["inserted_records"]:
        try:
            summary = generate_summary(record.get("title", ""), record.get("content", ""))
            update_summary(record["id"], summary)
            print(f"[SUMMARY] Updated | id={record['id']} | title={record.get('title', '')}")
        except Exception as exc:
            print(f"[SUMMARY-ERROR] id={record.get('id', '')} | error={exc}")

    print("---- RESULT ----")
    print(result["stats"])


if __name__ == "__main__":
    main()
