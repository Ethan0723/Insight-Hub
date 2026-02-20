"""CLI entrypoint for the news pipeline."""

from __future__ import annotations

from .config import load_config
from .processor import run_pipeline



def main() -> None:
    """Run the pipeline with basic default settings."""

    config = load_config()

    # Placeholder feed list. Future version can load from config file/env.
    feed_urls = []

    result = run_pipeline(
        feed_urls=feed_urls,
        claude_api_url=config.claude_api_url,
        claude_api_key=config.claude_api_key,
        supabase_url=config.supabase_url,
        supabase_service_role_key=config.supabase_service_role_key,
    )

    print("Pipeline finished:", result)


if __name__ == "__main__":
    main()
