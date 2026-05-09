"""Competitor official update ingestion.

Fetches Shopify/SHOPLINE product changelogs and policy pages into
`competitor_updates`, separate from the general `news_raw` pipeline.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

from .ai_client import generate_json_object
from .supabase_client import (
    fetch_competitor_updates_for_normalization,
    get_competitor_update_by_canonical_key,
    update_competitor_update_lightweight,
    upsert_competitor_update,
)

DEFAULT_START_DATE = datetime(2026, 1, 1, tzinfo=timezone.utc)
START_DATE = datetime.fromisoformat(
    os.getenv("COMPETITOR_UPDATES_START_DATE", "2026-01-01").replace("Z", "+00:00")
).replace(tzinfo=timezone.utc)
MAX_PRODUCT_ITEMS_PER_SOURCE = int(os.getenv("COMPETITOR_UPDATES_MAX_PRODUCT_ITEMS", "80"))
ENABLE_LLM = os.getenv("COMPETITOR_UPDATES_ENABLE_LLM", "true").lower() == "true"
DRY_RUN = os.getenv("COMPETITOR_UPDATES_DRY_RUN", "false").lower() == "true"
NORMALIZE_ONLY = os.getenv("COMPETITOR_UPDATES_NORMALIZE_ONLY", "false").lower() == "true"
NORMALIZE_LIMIT = int(os.getenv("COMPETITOR_UPDATES_NORMALIZE_LIMIT", "300"))

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7",
}

MONTHS = {
    "january": 1,
    "february": 2,
    "march": 3,
    "april": 4,
    "may": 5,
    "june": 6,
    "july": 7,
    "august": 8,
    "september": 9,
    "october": 10,
    "november": 11,
    "december": 12,
}


@dataclass
class Candidate:
    platform: str
    source_type: str
    source_name: str
    source_url: str
    detail_url: str
    title: str
    content: str
    summary: str = ""
    published_at: str | None = None
    effective_at: str | None = None
    update_label: str = ""
    product_area: str = ""
    event_type: str = "product_update"
    raw_payload: dict[str, Any] | None = None
    canonical_policy_snapshot: bool = False


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _clean_text(value: str) -> str:
    return re.sub(r"\s+", " ", value or "").strip()


def _clean_multiline(value: str) -> str:
    lines = [_clean_text(line) for line in (value or "").splitlines()]
    return "\n".join(line for line in lines if line)


def _hash_text(value: str) -> str:
    return hashlib.md5((value or "").strip().encode("utf-8")).hexdigest()


def _fetch_text(url: str, *, timeout: int = 25) -> str:
    response = requests.get(url, headers=HEADERS, timeout=timeout)
    response.raise_for_status()
    return response.text


def _html_text(html: str) -> str:
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "noscript", "svg"]):
        tag.decompose()
    return _clean_multiline(soup.get_text("\n"))


def _parse_date(text: str, default_year: int | None = None) -> datetime | None:
    raw = _clean_text(text)
    if not raw:
        return None

    m = re.search(r"(\d{4})[-/](\d{1,2})[-/](\d{1,2})", raw)
    if m:
        return datetime(int(m.group(1)), int(m.group(2)), int(m.group(3)), tzinfo=timezone.utc)

    m = re.search(r"(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})", raw)
    if m:
        month = MONTHS.get(m.group(2).lower())
        if month:
            return datetime(int(m.group(3)), month, int(m.group(1)), tzinfo=timezone.utc)

    m = re.search(r"([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})", raw)
    if m:
        month = MONTHS.get(m.group(1).lower())
        if month:
            return datetime(int(m.group(3)), month, int(m.group(2)), tzinfo=timezone.utc)

    if default_year:
        m = re.search(r"([A-Za-z]+)\s+(\d{1,2})", raw)
        if m:
            month = MONTHS.get(m.group(1).lower())
            if month:
                return datetime(default_year, month, int(m.group(2)), tzinfo=timezone.utc)

    return None


def _iso_or_none(dt: datetime | None) -> str | None:
    return dt.isoformat() if dt else None


def _infer_event_type(title: str, content: str, source_type: str) -> str:
    text = f"{title} {content}".lower()
    if source_type in {"policy_terms", "privacy", "payments_privacy", "dpa"}:
        if source_type in {"privacy", "payments_privacy", "dpa"}:
            return "privacy_change"
        return "policy_update"
    if source_type == "api_terms" or re.search(r"\bapi\b|graphql|rest|webhook|version", text):
        return "api_change"
    if re.search(r"action required|deprecat|retir|stop executing|no longer|sunset|migrate", text):
        return "deprecation"
    if re.search(r"payment|checkout|shop pay|billing", text):
        return "payment_change"
    if re.search(r"pricing|fee|subscription|plan", text):
        return "pricing_change"
    if re.search(r"security|verification|risk control", text):
        return "security_change"
    return "product_update"


def _infer_product_area(title: str, content: str) -> str:
    text = f"{title} {content}".lower()
    area_map = [
        ("B2B", [r"\bb2b\b", "wholesale", "company profile", "catalog"]),
        ("Checkout", ["checkout", "payment sorting", "payment hiding"]),
        ("Payments", [r"\bpayment\b", "billing", "shop pay", "payments"]),
        ("Themes", [r"\btheme\b", "online store", "os 3.0", "page component"]),
        ("POS", [r"\bpos\b", "point of sale", "register"]),
        ("API", [r"\bapi\b", "graphql", "webhook", "developer", "shopify functions", "scripts"]),
        ("Privacy", ["privacy", "personal data", "data processing"]),
        ("Marketing", ["campaign", "smartpush", "ads", "marketing", "shop feed"]),
        ("Security", ["security", "verification", "risk control"]),
    ]
    for area, keys in area_map:
        if any(re.search(key, text) if key.startswith("\\b") else key in text for key in keys):
            return area
    return "Platform"


def _rule_impact(candidate: Candidate) -> tuple[str, int, str, str, str]:
    text = f"{candidate.title} {candidate.content}".lower()
    high_terms = [
        "action required",
        "deprecat",
        "retir",
        "stop executing",
        "no longer",
        "checkout",
        "payment",
        "b2b",
        "api license",
        "partner program agreement",
    ]
    medium_terms = ["feature", "improvement", "new", "privacy", "terms", "dpa", "theme", "pos", "automation"]

    if any(term in text for term in high_terms):
        level = "高"
        score = 82
    elif any(term in text for term in medium_terms):
        level = "中"
        score = 62
    else:
        level = "低"
        score = 38

    reason = "基于官方更新中出现的功能范围、行动要求、支付/结账/API/政策关键词，按公司竞争影响做规则预判。"
    assumption = "若公司在该能力上缺失或弱于竞品，则影响上调；若已覆盖并有差异化，影响可下调。"
    action = "产品和战略侧复核对应能力差距，并决定是否纳入短期竞品跟踪清单。"
    return level, score, reason, assumption, action


def _is_bad_llm_text(value: Any) -> bool:
    text = str(value or "").strip()
    if not text:
        return True
    if "待翻译" in text or "信息不足" in text or "json" in text.lower():
        return True
    # These fields are user-facing Chinese analysis. Preserve English product
    # names inside the text, but reject pure-English fallbacks from failed LLM calls.
    return not any("\u4e00" <= ch <= "\u9fff" for ch in text)


def _focused_prompt_content(candidate: Candidate) -> str:
    text = candidate.content or candidate.summary or candidate.title
    text = _clean_multiline(text)
    if candidate.source_type == "product_changelog":
        return text[:1400]

    anchors = [
        "Updates to Shopify",
        "Shopify Terms of Service Update",
        "What changes are being made?",
        "Last updated",
        "Data Processing Addendum",
        "API License and Terms",
        "Partner Program Agreement",
    ]
    positions = [text.find(anchor) for anchor in anchors if text.find(anchor) >= 0]
    if positions:
        text = text[min(positions):]
    for footer_anchor in ["Shopify\nWhat is Shopify?", "Choose a region & language", "Terms of Service\nLegal"]:
        if footer_anchor in text:
            text = text.split(footer_anchor, 1)[0]
    return text[:2000]


def _extract_jsonish_translation(raw_text: Any) -> dict[str, str]:
    text = str(raw_text or "").strip()
    if not text:
        return {}

    def between(start: str, end: str | None) -> str:
        start_index = text.find(start)
        if start_index < 0:
            return ""
        start_index += len(start)
        end_index = text.find(end, start_index) if end else -1
        value = text[start_index:end_index if end_index >= 0 else None]
        return value.strip().rstrip(",").strip().strip('"').strip()

    return {
        "title_zh": between('"title_zh":', '"summary":'),
        "summary": between('"summary":', '"content_zh":'),
        "content_zh": between('"content_zh":', None).rstrip("}").strip().strip('"').strip(),
    }


def _translation_retry(candidate: Candidate) -> dict[str, str]:
    prompt = f"""
请把下面 Shopify/SHOPLINE 官方更新转成面向中文产品团队的简洁解读。
只输出严格 JSON，不要 Markdown。
字段：
{{
  "title_zh": "中文标题，40字以内",
  "summary": "中文摘要，80字以内",
  "content_zh": "中文解读正文，保留关键日期、功能点、行动要求，180字以内"
}}

平台：{candidate.platform}
来源类型：{candidate.source_type}
标题：{candidate.title}
正文：
{_focused_prompt_content(candidate)}
""".strip()
    try:
        result = generate_json_object(prompt, max_tokens=1200, temperature=0.1, timeout=90)
        data = result.get("data") if result.get("ok") else {}
        if not isinstance(data, dict):
            data = {}
        if _is_bad_llm_text(data.get("title_zh")) or _is_bad_llm_text(data.get("summary")) or _is_bad_llm_text(data.get("content_zh")):
            jsonish = _extract_jsonish_translation(result.get("raw_text"))
            data = {**data, **{k: v for k, v in jsonish.items() if v and not _is_bad_llm_text(v)}}
        return {
            "title_zh": str(data.get("title_zh") or "").strip(),
            "summary": str(data.get("summary") or "").strip(),
            "content_zh": str(data.get("content_zh") or "").strip(),
        }
    except Exception as exc:
        print(f"[WARN] competitor translation retry failed | title={candidate.title} | error={exc}")
        return {}


def _llm_impact(candidate: Candidate) -> dict[str, Any]:
    fallback_level, fallback_score, fallback_reason, fallback_assumption, fallback_action = _rule_impact(candidate)
    if not ENABLE_LLM:
        return {
            "competitive_impact": fallback_level,
            "importance_score": fallback_score,
            "impact_reason": fallback_reason,
            "gap_assumption": fallback_assumption,
            "recommended_action": fallback_action,
        }

    prompt = f"""
你是跨境电商 SaaS 公司的竞品情报分析师。请站在“公司”的视角评估 Shopify/SHOPLINE 官方更新。
只输出严格 JSON，不要 Markdown。
字段：
{{
  "title_zh": "中文标题，40字以内",
  "summary": "中文摘要，80字以内",
  "content_zh": "中文解读正文，保留关键日期、功能点、行动要求，180字以内",
  "event_type": "product_update|policy_update|api_change|deprecation|pricing_change|payment_change|privacy_change|security_change|other",
  "product_area": "B2B|Checkout|Payments|Themes|POS|API|Privacy|Marketing|Security|Platform",
  "competitive_impact": "高|中|低",
  "importance_score": 0,
  "impact_reason": "站在公司视角，解释为什么这个更新影响大/中/小，120字以内",
  "gap_assumption": "如果公司没有或弱于该能力，可能发生什么，120字以内",
  "recommended_action": "给产品/战略/商业化的一个后续动作，80字以内"
}}
语言规范：
- 提及我方主体时统一使用“公司”。
- 不要使用“自有平台”“我们平台”“我们的平台”“我们”等第一人称或不准确表述。

判断标准：
- 高：会明显影响商家选择、留存、ARPU、支付/结账转化、B2B/生态/API关键能力，或有明确弃用/迁移/政策行动要求。
- 中：提升竞品体验或效率，但影响范围局部，短期可通过现有能力或运营方案覆盖。
- 低：课程、轻量 UI、窄范围优化或法律措辞基线，主要做情报记录。

平台：{candidate.platform}
来源类型：{candidate.source_type}
标题：{candidate.title}
正文：
{_focused_prompt_content(candidate)}
""".strip()
    try:
        result = generate_json_object(prompt, max_tokens=1100, temperature=0.1, timeout=60)
        data = result.get("data") if result.get("ok") else {}
        if not isinstance(data, dict):
            data = {}
        impact = str(data.get("competitive_impact") or fallback_level)
        score = int(data.get("importance_score") or fallback_score)
        event_type = str(data.get("event_type") or candidate.event_type)
        product_area = str(data.get("product_area") or candidate.product_area)
        title_zh = str(data.get("title_zh") or "").strip()
        summary = str(data.get("summary") or "").strip()
        content_zh = str(data.get("content_zh") or "").strip()
        if _is_bad_llm_text(title_zh) or _is_bad_llm_text(summary) or _is_bad_llm_text(content_zh):
            retry = _translation_retry(candidate)
            title_zh = retry.get("title_zh") or title_zh
            summary = retry.get("summary") or summary
            content_zh = retry.get("content_zh") or content_zh
        return {
            "title_zh": "" if _is_bad_llm_text(title_zh) else title_zh[:500],
            "summary": "" if _is_bad_llm_text(summary) else summary[:260],
            "content_zh": "" if _is_bad_llm_text(content_zh) else content_zh[:1200],
            "event_type": event_type if event_type in {
                "product_update", "policy_update", "api_change", "deprecation", "pricing_change",
                "payment_change", "privacy_change", "security_change", "other"
            } else candidate.event_type,
            "product_area": product_area[:80] or candidate.product_area,
            "competitive_impact": impact if impact in {"高", "中", "低"} else fallback_level,
            "importance_score": max(0, min(100, score)),
            "impact_reason": str(data.get("impact_reason") or fallback_reason)[:500],
            "gap_assumption": str(data.get("gap_assumption") or fallback_assumption)[:500],
            "recommended_action": str(data.get("recommended_action") or fallback_action)[:500],
            "model": result.get("model"),
            "usage": result.get("usage") if isinstance(result.get("usage"), dict) else {},
        }
    except Exception as exc:
        print(f"[WARN] competitor LLM failed | title={candidate.title} | error={exc}")
        return {
            "competitive_impact": fallback_level,
            "importance_score": fallback_score,
            "impact_reason": fallback_reason,
            "gap_assumption": fallback_assumption,
            "recommended_action": fallback_action,
        }


def _candidate_identity(candidate: Candidate) -> tuple[str, str, str | None, str]:
    content = candidate.content or candidate.summary or candidate.title
    content_hash = _hash_text(content)
    if candidate.canonical_policy_snapshot:
        canonical_key = f"{candidate.platform}:{candidate.source_type}:{candidate.detail_url}:{content_hash[:12]}"
        content_changed_at = _utc_now_iso()
    else:
        canonical_key = f"{candidate.platform}:{candidate.detail_url}"
        content_changed_at = None
    return content, content_hash, content_changed_at, canonical_key


def _candidate_raw_payload(candidate: Candidate, content: str) -> dict[str, Any]:
    return {
        **(candidate.raw_payload or {}),
        "original_title": candidate.title,
        "original_summary": candidate.summary,
        "original_content": content,
    }


def _candidate_lightweight_payload(candidate: Candidate, content_hash: str, content: str) -> dict[str, Any]:
    candidate.product_area = candidate.product_area or _infer_product_area(candidate.title, content)
    return {
        "platform": candidate.platform,
        "source_type": candidate.source_type,
        "source_name": candidate.source_name,
        "source_url": candidate.source_url,
        "detail_url": candidate.detail_url,
        "raw_payload": _candidate_raw_payload(candidate, content),
        "published_at": candidate.published_at,
        "effective_at": candidate.effective_at,
        "last_checked_at": _utc_now_iso(),
        "update_label": candidate.update_label[:120] if candidate.update_label else None,
        "product_area": candidate.product_area,
        "content_hash": content_hash,
    }


def _candidate_to_payload(candidate: Candidate) -> dict[str, Any]:
    content, content_hash, content_changed_at, canonical_key = _candidate_identity(candidate)

    candidate.event_type = _infer_event_type(candidate.title, content, candidate.source_type)
    candidate.product_area = candidate.product_area or _infer_product_area(candidate.title, content)
    analysis = _llm_impact(candidate)
    title = analysis.get("title_zh") or candidate.title
    summary = analysis.get("summary") or candidate.summary or content[:300]
    translated_content = analysis.get("content_zh") or content
    raw_payload = _candidate_raw_payload(candidate, content)

    return {
        "platform": candidate.platform,
        "source_type": candidate.source_type,
        "source_name": candidate.source_name,
        "source_url": candidate.source_url,
        "detail_url": candidate.detail_url,
        "title": str(title)[:500],
        "summary": str(summary)[:1000],
        "content": str(translated_content)[:20000],
        "raw_payload": raw_payload,
        "published_at": candidate.published_at,
        "effective_at": candidate.effective_at,
        "last_checked_at": _utc_now_iso(),
        "content_changed_at": content_changed_at,
        "event_type": analysis.get("event_type") or candidate.event_type,
        "update_label": candidate.update_label[:120] if candidate.update_label else None,
        "product_area": analysis.get("product_area") or candidate.product_area,
        "status": "new",
        "competitive_impact": analysis.get("competitive_impact"),
        "impact_reason": analysis.get("impact_reason"),
        "gap_assumption": analysis.get("gap_assumption"),
        "recommended_action": analysis.get("recommended_action"),
        "importance_score": analysis.get("importance_score"),
        "content_hash": content_hash,
        "canonical_key": canonical_key,
        "summary_generated_at": _utc_now_iso() if ENABLE_LLM else None,
        "model": analysis.get("model"),
        "usage": analysis.get("usage") or {},
    }


def _shopify_detail(url: str, source_url: str, published_dt: datetime | None = None) -> Candidate | None:
    html = _fetch_text(url)
    soup = BeautifulSoup(html, "html.parser")
    text = _html_text(html)
    headings = [_clean_text(tag.get_text(" ")) for tag in soup.find_all(["h1", "h2"])]
    title = ""
    for heading in headings:
        if not heading:
            continue
        h = heading.lower()
        if "what" in h and "new in shopify" in h:
            continue
        if "more resources" in h:
            continue
        title = heading
        break

    if not title and soup.title:
        title = _clean_text(soup.title.get_text(" ")).replace(" - Shopify Changelog", "").strip()

    body = text
    if title and title in body:
        body = body.rsplit(title, 1)[1]
    body = body.split("More resources", 1)[0]
    body = body.replace("Feature Shop", "").replace("Improvement Shop", "").replace("Changed Shop", "")
    body = _clean_multiline(body)
    label = ""
    area = ""
    for line in body.splitlines()[-4:]:
        m = re.match(r"^(Feature|Improvement|Changed|New)\s+(.+)$", line.strip())
        if m:
            label = _clean_text(m.group(1))
            area = _clean_text(m.group(2))
            body = _clean_multiline(body.replace(line, ""))
            break

    if not title:
        return None
    effective_dt = None
    effective_match = re.search(
        r"(?:starting|from|effective(?:\s+on)?|as of)\s+([A-Za-z]+\s+\d{1,2},?\s+20\d{2})",
        f"{title}\n{body}",
        re.IGNORECASE,
    )
    if effective_match:
        effective_dt = _parse_date(effective_match.group(1))
    return Candidate(
        platform="Shopify",
        source_type="product_changelog",
        source_name="Shopify Changelog",
        source_url=source_url,
        detail_url=url,
        title=title,
        content=body,
        summary=body[:320],
        published_at=_iso_or_none(published_dt),
        effective_at=_iso_or_none(effective_dt),
        update_label=label,
        product_area=area,
        raw_payload={"source": "shopify_changelog"},
    )


def fetch_shopify_product_updates() -> list[Candidate]:
    source_url = "https://changelog.shopify.com/"
    html = _fetch_text(source_url)
    soup = BeautifulSoup(html, "html.parser")
    entries: list[tuple[str, datetime | None]] = []
    seen: set[str] = set()
    for block in soup.select(".changelog-post"):
        link = block.select_one('a[href*="/posts/"]')
        if not link:
            continue
        href = str(link.get("href") or "")
        url = urljoin(source_url, href)
        if url in seen:
            continue
        seen.add(url)
        date_label = _clean_text(block.select_one(".post-block__date") and block.select_one(".post-block__date").get_text(" "))
        published_dt = _parse_date(date_label, default_year=datetime.now(timezone.utc).year)
        entries.append((url, published_dt))
        if len(entries) >= MAX_PRODUCT_ITEMS_PER_SOURCE:
            break

    if not entries:
        for link in soup.find_all("a", href=True):
            href = str(link["href"])
            if "/posts/" not in href:
                continue
            url = urljoin(source_url, href)
            if url not in seen:
                entries.append((url, None))
                seen.add(url)
            if len(entries) >= MAX_PRODUCT_ITEMS_PER_SOURCE:
                break

    items: list[Candidate] = []
    for url, published_dt in entries:
        try:
            candidate = _shopify_detail(url, source_url, published_dt)
            if candidate:
                items.append(candidate)
        except Exception as exc:
            print(f"[WARN] shopify detail failed | url={url} | error={exc}")
    return items


def _shopline_article_from_json(article: dict[str, Any], source_url: str, section_name: str = "") -> Candidate | None:
    title = _clean_text(str(article.get("title") or ""))
    detail_url = str(article.get("html_url") or "").strip()
    body = _clean_multiline(BeautifulSoup(str(article.get("body") or ""), "html.parser").get_text("\n"))
    created_at = str(article.get("created_at") or "")
    updated_at = str(article.get("updated_at") or "")
    published_source_at = updated_at or created_at
    dt = datetime.fromisoformat(published_source_at.replace("Z", "+00:00")) if published_source_at else None
    if not title or not detail_url:
        return None
    if dt and dt < START_DATE:
        return None
    return Candidate(
        platform="Shopline",
        source_type="product_changelog",
        source_name="SHOPLINE New Releases",
        source_url=source_url,
        detail_url=detail_url,
        title=title,
        content=body or title,
        summary=(body or title)[:320],
        published_at=_iso_or_none(dt),
        update_label="New Release",
        raw_payload={
            "article_id": article.get("id"),
            "section_name": section_name,
            "date_precision": "day",
            "created_at": created_at,
            "updated_at": updated_at,
        },
    )


def _fetch_shopline_via_api(source_url: str) -> list[Candidate]:
    category_id = "41943237315609"
    section_url = f"https://help.shopline.com/api/v2/help_center/en-001/categories/{category_id}/sections.json?per_page=100"
    section_data = requests.get(section_url, headers=HEADERS, timeout=25)
    section_data.raise_for_status()
    sections = section_data.json().get("sections") or []
    items: list[Candidate] = []
    for section in sections:
        name = str(section.get("name") or "")
        if not re.search(r"20\d{2}", name):
            continue
        section_id = section.get("id")
        articles_url = f"https://help.shopline.com/api/v2/help_center/en-001/sections/{section_id}/articles.json?per_page=100"
        article_data = requests.get(articles_url, headers=HEADERS, timeout=25)
        article_data.raise_for_status()
        for article in article_data.json().get("articles") or []:
            candidate = _shopline_article_from_json(article, source_url, name)
            if candidate:
                items.append(candidate)
            if len(items) >= MAX_PRODUCT_ITEMS_PER_SOURCE:
                return items
    return items


def fetch_shopline_product_updates() -> list[Candidate]:
    source_url = "https://help.shopline.com/hc/en-001/categories/41943237315609-New-Releases/?utm_source=globalwebsite&utm_medium=globalfooter"
    try:
        items = _fetch_shopline_via_api(source_url)
        if items:
            return items
    except Exception as exc:
        print(f"[WARN] shopline api fetch failed, fallback to category html | error={exc}")

    html = _fetch_text(source_url)
    soup = BeautifulSoup(html, "html.parser")
    urls: list[str] = []
    for link in soup.find_all("a", href=True):
        href = str(link["href"])
        if "/hc/en-001/articles/" not in href:
            continue
        url = urljoin(source_url, href)
        if url not in urls:
            urls.append(url)
        if len(urls) >= MAX_PRODUCT_ITEMS_PER_SOURCE:
            break

    items: list[Candidate] = []
    for url in urls:
        try:
            html = _fetch_text(url)
            soup = BeautifulSoup(html, "html.parser")
            title = _clean_text((soup.find("h1") or soup.title or "").get_text(" ")) if soup.find("h1") or soup.title else ""
            text = _html_text(html)
            dt_match = re.search(r"(\d{1,2}\s+[A-Za-z]+\s+20\d{2})", text)
            dt = _parse_date(dt_match.group(1)) if dt_match else None
            if dt and dt < START_DATE:
                continue
            if title:
                items.append(
                    Candidate(
                        platform="Shopline",
                        source_type="product_changelog",
                        source_name="SHOPLINE New Releases",
                        source_url=source_url,
                        detail_url=url,
                        title=title,
                        content=text,
                        summary=text[:320],
                        published_at=_iso_or_none(dt),
                        update_label="New Release",
                        raw_payload={"source": "shopline_category_html"},
                    )
                )
        except Exception as exc:
            print(f"[WARN] shopline detail failed | url={url} | error={exc}")
    return items


POLICY_SOURCES = [
    ("Shopify", "policy_terms", "Shopify Terms of Service", "https://www.shopify.com/legal/terms"),
    ("Shopify", "policy_terms", "Shopify Terms FAQ", "https://www.shopify.com/legal/terms-faq"),
    ("Shopify", "policy_terms", "Shopify Partner Program Agreement", "https://www.shopify.com/partners/terms"),
    ("Shopify", "api_terms", "Shopify API License and Terms", "https://www.shopify.com/legal/api-terms"),
    ("Shopify", "policy_terms", "Shopify Partner/API FAQ", "https://help.shopify.com/en/partners/help-support/faq/ppa"),
    ("Shopify", "dpa", "Shopify Data Processing Addendum", "https://www.shopify.com/legal/dpa"),
]


def _policy_candidate(platform: str, source_type: str, source_name: str, url: str) -> Candidate | None:
    html = _fetch_text(url)
    text = _html_text(html)
    updated_match = re.search(
        r"(last updated(?: on)?:?\s+[A-Za-z]+\s+\d{1,2},\s+20\d{2}|"
        r"updated and effective as of\s+\d{1,2}\s+[A-Za-z]+,?\s+20\d{2}|"
        r"effective\s+[A-Za-z]+\s+\d{1,2},\s+20\d{2}|"
        r"effective as of\s+\d{1,2}\s+[A-Za-z]+,?\s+20\d{2})",
        text,
        re.I,
    )
    updated_text = updated_match.group(1) if updated_match else ""
    dt = _parse_date(updated_text)
    title = source_name
    if updated_text:
        title = f"{source_name} {updated_text}"
    return Candidate(
        platform=platform,
        source_type=source_type,
        source_name=source_name,
        source_url=url,
        detail_url=url,
        title=_clean_text(title),
        content=text,
        summary=text[:420],
        published_at=_iso_or_none(dt),
        effective_at=_iso_or_none(dt),
        update_label="Policy snapshot",
        raw_payload={"last_updated_text": updated_text, "snapshot_url": url},
        canonical_policy_snapshot=True,
    )


def fetch_policy_updates() -> list[Candidate]:
    items: list[Candidate] = []
    for source in POLICY_SOURCES:
        try:
            candidate = _policy_candidate(*source)
            if candidate:
                items.append(candidate)
        except Exception as exc:
            print(f"[WARN] policy fetch failed | source={source[2]} | error={exc}")
    return items


def _candidate_from_existing(row: dict[str, Any]) -> Candidate:
    raw_payload = row.get("raw_payload") if isinstance(row.get("raw_payload"), dict) else {}
    original_title = str(raw_payload.get("original_title") or row.get("title") or "")
    original_content = str(raw_payload.get("original_content") or row.get("content") or row.get("summary") or "")
    original_summary = str(raw_payload.get("original_summary") or row.get("summary") or "")
    return Candidate(
        platform=str(row.get("platform") or "Shopify"),
        source_type=str(row.get("source_type") or "product_changelog"),
        source_name=str(row.get("source_name") or ""),
        source_url=str(row.get("source_url") or row.get("detail_url") or ""),
        detail_url=str(row.get("detail_url") or ""),
        title=original_title,
        content=original_content,
        summary=original_summary,
        published_at=str(row.get("published_at") or "") or None,
        effective_at=str(row.get("effective_at") or "") or None,
        update_label=str(row.get("update_label") or ""),
        product_area=str(row.get("product_area") or "") or _infer_product_area(original_title, original_content),
        event_type=str(row.get("event_type") or "product_update"),
        raw_payload=raw_payload,
        canonical_policy_snapshot=bool(str(row.get("source_type") or "") != "product_changelog"),
    )


def normalize_existing_records() -> dict[str, int]:
    rows = fetch_competitor_updates_for_normalization(limit=NORMALIZE_LIMIT)
    stats = {"fetched": len(rows), "upserted": 0, "errors": 0}
    print(f"[COMPETITOR-NORMALIZE] records needing normalization: {len(rows)}", flush=True)
    for index, row in enumerate(rows, start=1):
        try:
            candidate = _candidate_from_existing(row)
            print(
                f"[COMPETITOR-NORMALIZE] {index}/{len(rows)} | {candidate.platform} | {candidate.title}",
                flush=True,
            )
            payload = _candidate_to_payload(candidate)
            if not DRY_RUN:
                upsert_competitor_update(payload)
            stats["upserted"] += 1
        except Exception as exc:
            stats["errors"] += 1
            print(f"[ERROR] normalize failed | id={row.get('id')} | error={exc}", flush=True)
    return stats


def run() -> dict[str, int]:
    if NORMALIZE_ONLY:
        return normalize_existing_records()

    print("[COMPETITOR] fetching Shopify product updates...", flush=True)
    shopify_products = fetch_shopify_product_updates()
    print(f"[COMPETITOR] fetched Shopify product updates: {len(shopify_products)}", flush=True)

    print("[COMPETITOR] fetching SHOPLINE product updates...", flush=True)
    shopline_products = fetch_shopline_product_updates()
    print(f"[COMPETITOR] fetched SHOPLINE product updates: {len(shopline_products)}", flush=True)

    print("[COMPETITOR] fetching policy snapshots...", flush=True)
    policies = fetch_policy_updates()
    print(f"[COMPETITOR] fetched policy snapshots: {len(policies)}", flush=True)

    candidates = [*shopify_products, *shopline_products, *policies]
    stats = {"fetched": len(candidates), "analyzed": 0, "refreshed": 0, "upserted": 0, "errors": 0}
    for index, candidate in enumerate(candidates, start=1):
        try:
            content, content_hash, _, canonical_key = _candidate_identity(candidate)
            existing = None if DRY_RUN else get_competitor_update_by_canonical_key(canonical_key)
            if existing and str(existing.get("content_hash") or "") == content_hash:
                payload = _candidate_lightweight_payload(candidate, content_hash, content)
                updated = update_competitor_update_lightweight(canonical_key, payload)
                stats["refreshed"] += 1 if updated else 0
                print(
                    f"[COMPETITOR] unchanged | {index}/{len(candidates)} | {candidate.platform} | {candidate.title}",
                    flush=True,
                )
                continue

            print(
                f"[COMPETITOR] analyzing {index}/{len(candidates)} | {candidate.platform} | {candidate.title}",
                flush=True,
            )
            payload = _candidate_to_payload(candidate)
            stats["analyzed"] += 1
            if DRY_RUN:
                stats["upserted"] += 1
                print(
                    "[COMPETITOR-DRY-RUN] "
                    f"{candidate.platform} | {payload['event_type']} | {payload['competitive_impact']} | "
                    f"{candidate.title} | {candidate.detail_url}",
                    flush=True,
                )
            else:
                upserted = upsert_competitor_update(payload)
                stats["upserted"] += 1 if upserted else 0
                print(f"[COMPETITOR] upserted | {candidate.platform} | {candidate.title}", flush=True)
        except Exception as exc:
            stats["errors"] += 1
            print(f"[ERROR] competitor upsert failed | title={candidate.title} | error={exc}", flush=True)
    return stats


if __name__ == "__main__":
    result = run()
    print(json.dumps(result, ensure_ascii=False))
