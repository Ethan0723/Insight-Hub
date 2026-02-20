from .fetcher import fetch_rss_items
from .processor import process_news_items


def main():
    print("Fetching RSS...")
    items = fetch_rss_items()

    print(f"Fetched {len(items)} items")

    stats = process_news_items(items)

    print("---- RESULT ----")
    print(stats)


if __name__ == "__main__":
    main()
