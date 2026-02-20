from .ai_client import generate_summary
from .fetcher import fetch_rss_items
from .processor import process_news_items
from .supabase_client import update_summary



def main():
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
