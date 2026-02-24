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
    {"name": "Shopify Blog", "url": "https://www.shopify.com/blog.atom"},
    {
        "name": "Google News - Shopify Investors",
        "url": "https://news.google.com/rss/search?q=site:investors.shopify.com+Shopify+press+release+OR+earnings",
    },
    {"name": "Google News - Amazon Official", "url": "https://news.google.com/rss/search?q=site:aboutamazon.com"},
    {"name": "Google News - TikTok Official", "url": "https://news.google.com/rss/search?q=site:newsroom.tiktok.com"},
    {
        "name": "Google News - PDD/Temu Investor",
        "url": "https://news.google.com/rss/search?q=site:investor.pddholdings.com",
    },
    {"name": "Google News - Alibaba Official", "url": "https://news.google.com/rss/search?q=site:alibabagroup.com"},
    {"name": "OpenAI Blog RSS", "url": "https://openai.com/blog/rss.xml"},
    {"name": "AWS AI/ML Blog", "url": "https://aws.amazon.com/blogs/machine-learning/feed/"},
    {"name": "DigitalCommerce360", "url": "https://www.digitalcommerce360.com/feed"},
    {"name": "Modern Retail", "url": "https://www.modernretail.co/feed"},
    {"name": "RetailDive", "url": "https://www.retaildive.com/rss"},
    {"name": "SupplyChainDive", "url": "https://www.supplychaindive.com/rss"},
    {"name": "FreightWaves", "url": "https://www.freightwaves.com/rss"},
    {"name": "PYMNTS", "url": "https://www.pymnts.com/rss/"},
    {"name": "PYMNTS Ecommerce", "url": "https://www.pymnts.com/news/ecommerce/feed/"},
    {"name": "Google News - WTO Policy", "url": "https://news.google.com/rss/search?q=site:wto.org ecommerce OR tariff"},
    {
        "name": "Google News - OECD Macro/Trade",
        "url": "https://news.google.com/rss/search?q=site:oecd.org cross-border ecommerce",
    },
    {
        "name": "Google News - White House Trade",
        "url": "https://news.google.com/rss/search?q=site:whitehouse.gov ecommerce OR trade",
    },
    {
        "name": "Google News - US Commerce Dept",
        "url": "https://news.google.com/rss/search?q=site:commerce.gov ecommerce OR tariff",
    },
    {"name": "a16z Feed", "url": "https://a16z.com/feed/"},
    {"name": "TechCrunch AI", "url": "https://techcrunch.com/tag/ai/feed/"},
    {"name": "WooCommerce Blog", "url": "https://woocommerce.com/blog/feed/"},
    {"name": "Shopify Partners Blog", "url": "https://www.shopify.com/partners/blog.atom"},
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
    llm_api_url: str
    llm_api_key: str
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
        llm_api_url=os.getenv("LLM_API_URL", os.getenv("CLAUDE_API_URL", "")),
        llm_api_key=os.getenv("LLM_API_KEY", os.getenv("CLAUDE_API_KEY", "")),
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
