"""Supabase persistence client for raw news records."""

from __future__ import annotations

import os
import json
from datetime import datetime, timezone
from typing import Any

from dotenv import load_dotenv
from supabase import Client, create_client

load_dotenv()

_TABLE = "news_raw"
_DAILY_BRIEF_TABLE = "daily_brief"

_SUPABASE_URL = os.getenv("SUPABASE_URL", "")
_SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

if not _SUPABASE_URL or not _SUPABASE_SERVICE_ROLE_KEY:
    raise ValueError("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.")

# Initialize once at module load.
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


def upsert_competitor_update(data: dict[str, Any]) -> dict[str, Any]:
    """Upsert one competitor update by canonical key."""
    response = (
        _client.table("competitor_updates")
        .upsert(data, on_conflict="canonical_key")
        .execute()
    )
    rows = response.data or []
    return rows[0] if rows else {}


def get_competitor_update_by_canonical_key(canonical_key: str) -> dict[str, Any] | None:
    """Return an existing competitor update by canonical key, or None if not found."""
    response = (
        _client.table("competitor_updates")
        .select("id,canonical_key,content_hash")
        .eq("canonical_key", canonical_key)
        .limit(1)
        .execute()
    )
    rows = response.data or []
    return rows[0] if rows else None


def update_competitor_update_lightweight(canonical_key: str, data: dict[str, Any]) -> dict[str, Any]:
    """Update lightweight metadata for an unchanged competitor update."""
    response = (
        _client.table("competitor_updates")
        .update(data)
        .eq("canonical_key", canonical_key)
        .execute()
    )
    rows = response.data or []
    return rows[0] if rows else {}


def fetch_competitor_updates_for_normalization(limit: int = 300) -> list[dict[str, Any]]:
    """Fetch competitor updates that still need Chinese title/content normalization."""
    try:
        response = (
            _client.table("competitor_updates")
            .select(
                "id,platform,source_type,source_name,source_url,detail_url,title,summary,content,raw_payload,"
                "published_at,effective_at,event_type,update_label,product_area,status,competitive_impact,"
                "impact_reason,gap_assumption,recommended_action,importance_score,content_hash,canonical_key"
            )
            .order("published_at", desc=True)
            .limit(limit)
            .execute()
        )
        rows = response.data or []
        needs: list[dict[str, Any]] = []
        for row in rows:
            title = str(row.get("title") or "")
            content = str(row.get("content") or "")
            summary = str(row.get("summary") or "")
            if (
                "待翻译" in title
                or (title and not any("\u4e00" <= ch <= "\u9fff" for ch in title))
                or (content and not any("\u4e00" <= ch <= "\u9fff" for ch in content))
                or (summary and not any("\u4e00" <= ch <= "\u9fff" for ch in summary))
            ):
                needs.append(row)
        return needs
    except Exception as exc:
        print(f"[WARN] fetch_competitor_updates_for_normalization failed | error={exc}")
        return []



def update_summary(news_id: str, summary: dict[str, Any] | str) -> None:
    """Update summary JSONB and denormalized fields for a news_raw record.

    Requirements handled:
    - Keep full summary in `summary` (JSONB).
    - Split selected fields into dedicated columns.
    - Missing fields are written as NULL (None).
    - Do not crash the pipeline on malformed payload.
    """
    try:
        summary_obj: dict[str, Any]

        if isinstance(summary, dict):
            summary_obj = summary
        elif isinstance(summary, str):
            # Attempt to parse string JSON payload.
            parsed = json.loads(summary)
            summary_obj = parsed if isinstance(parsed, dict) else {}
        else:
            summary_obj = {}

        payload = {
            # Full summary JSONB
            "summary": summary_obj if summary_obj else None,
            "summary_generated_at": datetime.now(timezone.utc).isoformat(),
            # Denormalized columns (safe .get with NULL fallback)
            "impact_score": summary_obj.get("impact_score", None),
            "risk_level": summary_obj.get("risk_level", None),
            "platform": summary_obj.get("platform", None),
            "region": summary_obj.get("region", None),
            "event_type": summary_obj.get("event_type", None),
            "importance_level": summary_obj.get("importance_level", None),
            "sentiment_score": summary_obj.get("sentiment_score", None),
        }

        _client.table(_TABLE).update(payload).eq("id", news_id).execute()
    except Exception as exc:
        # Intentionally swallow to avoid breaking the pipeline.
        print(f"[WARN] update_summary failed | id={news_id} | error={exc}")


def update_news_content(news_id: str, content: str, content_hash: str) -> None:
    """Update raw content and hash after successful body recovery."""
    try:
        payload = {
            "content": (content or "").strip(),
            "content_hash": content_hash,
        }
        _client.table(_TABLE).update(payload).eq("id", news_id).execute()
    except Exception as exc:
        print(f"[WARN] update_news_content failed | id={news_id} | error={exc}")


def get_news_without_summary() -> list[dict[str, Any]]:
    """Return all records where summary is null."""
    response = (
        _client.table(_TABLE)
        .select("id, title, content")
        .is_("summary", "null")
        .execute()
    )
    return response.data or []


def get_news_missing_title_zh(limit: int = 500) -> list[dict[str, Any]]:
    """Return records where summary exists but title_zh is missing in summary JSON."""
    try:
        response = (
            _client.table(_TABLE)
            .select("id, title, content, summary")
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        rows = response.data or []
        missing: list[dict[str, Any]] = []
        for row in rows:
            summary = row.get("summary")
            if not isinstance(summary, dict):
                missing.append(
                    {"id": row.get("id"), "title": row.get("title", ""), "content": row.get("content", "")}
                )
                continue
            if not str(summary.get("title_zh", "")).strip():
                missing.append(
                    {"id": row.get("id"), "title": row.get("title", ""), "content": row.get("content", "")}
                )
        return missing
    except Exception as exc:
        print(f"[WARN] get_news_missing_title_zh failed | error={exc}")
        return []


def get_latest_publish_time() -> datetime | None:
    """Return latest publish_time from news_raw, or None when table is empty."""
    try:
        response = (
            _client.table(_TABLE)
            .select("publish_time")
            .order("publish_time", desc=True)
            .limit(1)
            .execute()
        )
        data = response.data or []
        if not data:
            return None
        raw = data[0].get("publish_time")
        if not raw:
            return None
        # Handle both "...Z" and offset formats.
        normalized = str(raw).replace("Z", "+00:00")
        return datetime.fromisoformat(normalized)
    except Exception as exc:
        print(f"[WARN] get_latest_publish_time failed | error={exc}")
        return None


def fetch_news_raw_for_cleanup(limit: int = 5000) -> list[dict[str, Any]]:
    """Fetch rows for cleanup analysis."""
    try:
        response = (
            _client.table(_TABLE)
            .select("id,title,content,summary,source,url,publish_time")
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        return response.data or []
    except Exception as exc:
        print(f"[WARN] fetch_news_raw_for_cleanup failed | error={exc}")
        return []


def delete_news_by_ids(news_ids: list[str]) -> int:
    """Delete rows by id and return attempted delete count."""
    if not news_ids:
        return 0
    try:
        # Batch to avoid oversized query.
        batch_size = 200
        deleted = 0
        for i in range(0, len(news_ids), batch_size):
            batch = news_ids[i : i + batch_size]
            _client.table(_TABLE).delete().in_("id", batch).execute()
            deleted += len(batch)
        return deleted
    except Exception as exc:
        print(f"[WARN] delete_news_by_ids failed | error={exc}")
        return 0


def fetch_news_raw_for_daily_brief(
    *,
    window_start_iso: str,
    window_end_iso: str,
    limit: int = 120,
) -> list[dict[str, Any]]:
    """Fetch news_raw rows in [window_start, window_end) for daily brief generation."""
    try:
        response = (
            _client.table(_TABLE)
            .select(
                "id,title,content,source,url,summary,impact_score,risk_level,platform,region,created_at,publish_time,event_type"
            )
            .gte("created_at", window_start_iso)
            .lt("created_at", window_end_iso)
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        return response.data or []
    except Exception as exc:
        print(f"[WARN] fetch_news_raw_for_daily_brief failed | error={exc}")
        return []


def upsert_daily_brief(payload: dict[str, Any]) -> dict[str, Any]:
    """Upsert one daily_brief row by (brief_date, prompt_version)."""
    response = (
        _client.table(_DAILY_BRIEF_TABLE)
        .upsert(payload, on_conflict="brief_date,prompt_version")
        .execute()
    )
    rows = response.data or []
    return rows[0] if rows else {}


def fetch_latest_daily_brief_by_date(*, brief_date: str, prompt_version: str) -> dict[str, Any] | None:
    """Fetch latest daily_brief row by (brief_date, prompt_version)."""
    try:
        response = (
            _client.table(_DAILY_BRIEF_TABLE)
            .select(
                "id,brief_date,headline,one_liner,top_drivers,impacts,actions,citations,stats,prompt_version,generated_at"
            )
            .eq("brief_date", brief_date)
            .eq("prompt_version", prompt_version)
            .order("generated_at", desc=True)
            .limit(1)
            .execute()
        )
        rows = response.data or []
        return rows[0] if rows else None
    except Exception as exc:
        print(f"[WARN] fetch_latest_daily_brief_by_date failed | error={exc}")
        return None
