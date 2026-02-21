"""Configuration helpers for the news pipeline."""

from __future__ import annotations

import os
from dataclasses import dataclass

from dotenv import load_dotenv


# RSS feeds that can be fetched in the current pipeline.
# Note: API-only sources (IMF/World Bank/OECD/BLS/arXiv...) need dedicated clients
# and are not part of RSS fetcher yet.
DEFAULT_RSS_FEEDS: list[dict[str, str]] = [
    {"name": "Google News", "url": "https://news.google.com/rss/search?q=cross+border+ecommerce"},
    {"name": "TechCrunch", "url": "https://techcrunch.com/feed/"},
    {"name": "Tech in Asia", "url": "https://www.techinasia.com/feed"},
    {"name": "PracticalEcommerce", "url": "https://www.practicalecommerce.com/feed"},
    {"name": "EcommerceBytes", "url": "https://www.ecommercebytes.com/C/blog/blog.pl?/xml/rss20.xml"},
    {"name": "亿邦动力", "url": "https://www.ebrun.com/rss/"},
    {"name": "雨果网", "url": "https://www.cifnews.com/xmlconfig/YuGuo.xml"},
    {"name": "36Kr", "url": "https://36kr.com/feed"},
    {"name": "Shopify Blog", "url": "https://www.shopify.com/blog.atom"},
    {"name": "Stripe Blog", "url": "https://stripe.com/blog/feed"},
    {"name": "OpenAI Blog", "url": "https://openai.com/blog/rss.xml"},
    {"name": "Anthropic Blog", "url": "https://www.anthropic.com/news/rss.xml"},
    {"name": "Google Ads Blog", "url": "https://blog.google/products/ads-commerce/rss/"},
    {"name": "Meta Ads Blog", "url": "https://www.facebook.com/business/news/rss"},
    {"name": "AWS Blog", "url": "https://aws.amazon.com/blogs/aws/feed/"},
    {"name": "NVIDIA News", "url": "https://nvidianews.nvidia.com/rss.xml"},
    {"name": "USTR", "url": "https://ustr.gov/about-us/policy-offices/press-office/press-releases/rss.xml"},
    {"name": "CBP", "url": "https://www.cbp.gov/newsroom/rss.xml"},
    {"name": "FTC", "url": "https://www.ftc.gov/news-events/news/rss"},
    {"name": "Commerce Dept", "url": "https://www.commerce.gov/rss.xml"},
    {"name": "White House", "url": "https://www.whitehouse.gov/briefing-room/feed/"},
    {"name": "EU Press", "url": "https://ec.europa.eu/commission/presscorner/api/rss"},
    {"name": "WTO", "url": "https://www.wto.org/english/news_e/news_e.xml"},
    {"name": "Amazon News", "url": "https://press.aboutamazon.com/rss"},
    {"name": "eBay News", "url": "https://investors.ebayinc.com/rss/news-releases.xml"},
    {"name": "Walmart News", "url": "https://corporate.walmart.com/rss.xml"},
    {"name": "Alibaba Group", "url": "https://www.alibabagroup.com/en/news/rss"},
    {"name": "Rakuten", "url": "https://global.rakuten.com/corp/news/rss.xml"},
    {"name": "Adyen", "url": "https://www.adyen.com/blog/rss.xml"},
    {"name": "PayPal", "url": "https://investor.pypl.com/news-releases/rss"},
    {"name": "Airwallex", "url": "https://www.airwallex.com/blog/rss.xml"},
    {"name": "Wise", "url": "https://wise.com/gb/blog/rss.xml"},
    {"name": "Amazon Advertising", "url": "https://advertising.amazon.com/resources/whats-new/rss"},
    {"name": "Pinterest Ads", "url": "https://business.pinterest.com/blog/rss/"},
    {"name": "LinkedIn Ads", "url": "https://business.linkedin.com/marketing-solutions/blog/rss"},
    {"name": "Google AI", "url": "https://blog.google/technology/ai/rss/"},
    {"name": "Azure AI", "url": "https://azure.microsoft.com/en-us/blog/rss/"},
    {"name": "AWS AI", "url": "https://aws.amazon.com/blogs/machine-learning/feed/"},
    {"name": "IDC", "url": "https://www.idc.com/getdoc.jsp?containerId=prUS.xml"},
    {"name": "Gartner", "url": "https://www.gartner.com/en/newsroom/rss"},
    {"name": "Forrester", "url": "https://www.forrester.com/newsroom/rss/"},
    {"name": "McKinsey", "url": "https://www.mckinsey.com/rss"},
    {"name": "Deloitte", "url": "https://www2.deloitte.com/rss.xml"},
]


@dataclass
class PipelineConfig:
    """Runtime configuration loaded from environment variables."""

    supabase_url: str
    supabase_service_role_key: str
    claude_api_url: str
    claude_api_key: str


def load_config() -> PipelineConfig:
    """Load pipeline configuration from environment variables."""
    load_dotenv()
    return PipelineConfig(
        supabase_url=os.getenv("SUPABASE_URL", ""),
        supabase_service_role_key=os.getenv("SUPABASE_SERVICE_ROLE_KEY", ""),
        claude_api_url=os.getenv("CLAUDE_API_URL", ""),
        claude_api_key=os.getenv("CLAUDE_API_KEY", ""),
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
