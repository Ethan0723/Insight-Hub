"""Configuration helpers for the news pipeline."""

from __future__ import annotations

import os
from dataclasses import dataclass

from dotenv import load_dotenv


@dataclass
class PipelineConfig:
    """Runtime configuration loaded from environment variables."""

    supabase_url: str
    supabase_service_role_key: str
    claude_api_url: str
    claude_api_key: str



def load_config() -> PipelineConfig:
    """Load pipeline configuration from environment variables.

    This is intentionally minimal for now. Validation and richer config
    parsing can be added when real integration begins.
    """

    load_dotenv()
    return PipelineConfig(
        supabase_url=os.getenv("SUPABASE_URL", ""),
        supabase_service_role_key=os.getenv("SUPABASE_SERVICE_ROLE_KEY", ""),
        claude_api_url=os.getenv("CLAUDE_API_URL", ""),
        claude_api_key=os.getenv("CLAUDE_API_KEY", ""),
    )
