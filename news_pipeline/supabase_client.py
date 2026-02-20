"""Supabase persistence client for raw news records."""

from __future__ import annotations

import os
from typing import Any

from dotenv import load_dotenv
from supabase import Client, create_client

load_dotenv()

_TABLE = "news_raw"

_SUPABASE_URL = os.getenv("SUPABASE_URL", "")
_SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

if not _SUPABASE_URL or not _SUPABASE_SERVICE_ROLE_KEY:
    raise ValueError("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.")

# 初始化一次 client（不要每次 new）
_client: Client = create_client(_SUPABASE_URL, _SUPABASE_SERVICE_ROLE_KEY)


def get_news_by_hash(content_hash: str) -> dict[str, Any] | None:
    """Return an existing news_raw record by content_hash, or None if not found."""
    response = (
        _client.table(_TABLE)
        .select("id, content_hash")
        .eq("content_hash", content_hash)
        .limit(1)
        .execute()
    )

    data = response.data or []
    return data[0] if data else None


def insert_news_raw(data: dict[str, Any]) -> dict[str, Any]:
    """Insert a record into news_raw and return inserted row data."""
    response = _client.table(_TABLE).insert(data).execute()
    inserted = response.data or []
    return inserted[0] if inserted else {}
