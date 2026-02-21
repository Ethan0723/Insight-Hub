"""Configuration helpers for the news pipeline."""

from __future__ import annotations

import os
from dataclasses import dataclass

from dotenv import load_dotenv


# Curated, cross-border focused feed list.
# We intentionally keep this list small and high-signal to reduce runtime noise.
DEFAULT_RSS_FEEDS: list[dict[str, str]] = [
    {
        "name": "Google News - Cross Border Ecommerce",
        "url": "https://news.google.com/rss/search?q=cross+border+ecommerce+OR+cross-border+policy+OR+customs+tariff",
    },
    {
        "name": "Google News - Shopify Earnings",
        "url": "https://news.google.com/rss/search?q=Shopify+earnings+OR+Shopify+quarterly+results+OR+Shopify+GMV",
    },
    {
        "name": "Google News - Stripe Payments",
        "url": "https://news.google.com/rss/search?q=Stripe+payments+OR+cross-border+payment+fees+OR+merchant+payment+policy",
    },
    {
        "name": "Google News - Amazon/TikTok/Temu",
        "url": "https://news.google.com/rss/search?q=Amazon+OR+TikTok+Shop+OR+Temu+cross-border+ecommerce",
    },
    {"name": "TechCrunch Ecommerce", "url": "https://techcrunch.com/category/e-commerce/feed/"},
    {"name": "PracticalEcommerce", "url": "https://www.practicalecommerce.com/feed"},
    {"name": "Shopify Changelog", "url": "https://changelog.shopify.com/en/feed"},
    # Shopify investor news RSS (if endpoint availability changes, keep Google News fallback above).
    {
        "name": "Shopify IR News",
        "url": "https://investors.shopify.com/news-and-events/press-releases/default.aspx?output=1",
    },
    # Stripe official blog feed endpoint has been unstable; use docs changelog as official product signal.
    {"name": "Stripe Docs Changelog", "url": "https://docs.stripe.com/changelog.rss"},
    {"name": "USTR", "url": "https://ustr.gov/about-us/policy-offices/press-office/press-releases/rss.xml"},
    {"name": "EU Press", "url": "https://ec.europa.eu/commission/presscorner/api/rss"},
    {"name": "WTO News", "url": "https://www.wto.org/english/news_e/news_e.xml"},
]


@dataclass
class PipelineConfig:
    """Runtime configuration loaded from environment variables."""

    supabase_url: str
    supabase_service_role_key: str
    claude_api_url: str
    claude_api_key: str
    enable_summary: bool
    max_entries_per_feed: int
    google_window_days: int
    max_google_windows: int


def load_config() -> PipelineConfig:
    """Load pipeline configuration from environment variables."""
    load_dotenv()
    return PipelineConfig(
        supabase_url=os.getenv("SUPABASE_URL", ""),
        supabase_service_role_key=os.getenv("SUPABASE_SERVICE_ROLE_KEY", ""),
        claude_api_url=os.getenv("CLAUDE_API_URL", ""),
        claude_api_key=os.getenv("CLAUDE_API_KEY", ""),
        enable_summary=os.getenv("ENABLE_SUMMARY", "true").lower() == "true",
        max_entries_per_feed=int(os.getenv("MAX_ENTRIES_PER_FEED", "80")),
        google_window_days=int(os.getenv("GOOGLE_WINDOW_DAYS", "7")),
        max_google_windows=int(os.getenv("MAX_GOOGLE_WINDOWS", "24")),
    )


def get_default_rss_feeds() -> list[dict[str, str]]:
    """Return configured RSS feeds with duplicate URLs removed."""
    seen: set[str] = set()
    deduped: list[dict[str, str]] = []
    for feed in DEFAULT_RSS_FEEDS:
        url = feed.get("url", "").strip()
        if not url or url in seen:
            continue
        seen.add(url)
        deduped.append({"name": feed.get("name", "Unknown"), "url": url})
    return deduped
