from __future__ import annotations

import json
import os
from datetime import datetime, timedelta, timezone
from typing import Any

from .ai_client import generate_json_object
from .supabase_client import fetch_news_raw_for_daily_brief, upsert_daily_brief

UTC8 = timezone(timedelta(hours=8))
PROMPT_VERSION = os.getenv("DAILY_BRIEF_PROMPT_VERSION", "v1")
DAILY_BRIEF_TZ = os.getenv("DAILY_BRIEF_TZ", "Asia/Shanghai")
MAX_NEWS = int(os.getenv("DAILY_BRIEF_MAX_NEWS", "50"))
FETCH_LIMIT = int(os.getenv("DAILY_BRIEF_FETCH_LIMIT", "120"))
LLM_MAX_TOKENS = int(os.getenv("DAILY_BRIEF_MAX_TOKENS", os.getenv("LLM_MAX_TOKENS", "1500")))
LLM_TEMPERATURE = float(os.getenv("DAILY_BRIEF_TEMPERATURE", "0.2"))
LLM_TIMEOUT = int(os.getenv("DAILY_BRIEF_TIMEOUT_SEC", "90"))

RISK_WEIGHT = {"高": 3, "中": 2, "低": 1}


def _utc8_window(now_utc: datetime | None = None) -> tuple[str, datetime, datetime]:
    now_utc = now_utc or datetime.now(timezone.utc)
    now_local = now_utc.astimezone(UTC8)
    day_local = now_local.date()
    start_local = datetime.combine(day_local, datetime.min.time(), tzinfo=UTC8)
    end_local = start_local + timedelta(days=1)
    return day_local.isoformat(), start_local.astimezone(timezone.utc), end_local.astimezone(timezone.utc)


def _parse_json_obj(raw: Any) -> dict[str, Any]:
    if isinstance(raw, dict):
        return raw
    if isinstance(raw, str):
        try:
            parsed = json.loads(raw)
            if isinstance(parsed, dict):
                return parsed
        except Exception:
            return {}
    return {}


def _normalize_text(value: Any) -> str:
    return " ".join(str(value or "").strip().split())


def _truncate_for_prompt(value: Any, limit: int) -> str:
    text = _normalize_text(value)
    if len(text) <= limit:
        return text
    return text[:limit].rstrip()


def _detect_tags(row: dict[str, Any], summary_obj: dict[str, Any], merged_text: str) -> list[str]:
    tags: list[str] = []

    summary_tags = summary_obj.get("tags")
    if isinstance(summary_tags, list):
        tags.extend([str(tag).strip() for tag in summary_tags if str(tag).strip()])

    event_type = str(row.get("event_type") or "").strip()
    if event_type:
        tags.append(event_type)

    text = merged_text.lower()
    if any(k in text for k in ["policy", "regulation", "compliance", "tariff", "政策", "监管", "关税"]):
        tags.append("政策")
    if any(k in text for k in ["payment", "chargeback", "fraud", "支付", "风控"]):
        tags.append("支付")
    if any(k in text for k in ["shipping", "logistics", "fulfillment", "物流", "履约"]):
        tags.append("履约")
    if any(k in text for k in ["google", "meta", "ads", "获客", "投放"]):
        tags.append("获客")
    if any(k in text for k in ["shopify", "amazon", "tiktok", "temu", "竞争", "平台"]):
        tags.append("竞争")

    unique: list[str] = []
    seen: set[str] = set()
    for tag in tags:
        if not tag or tag in seen:
            continue
        seen.add(tag)
        unique.append(tag)
    return unique[:8]


def _build_input_news(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    candidates: list[dict[str, Any]] = []

    for row in rows:
        summary_obj = _parse_json_obj(row.get("summary"))
        summary_text = (
            str(summary_obj.get("tldr") or "").strip()
            or str(summary_obj.get("core_summary") or "").strip()
            or str(row.get("title") or "").strip()
        )
        if not summary_text:
            summary_text = str(row.get("content") or "").strip()

        merged = f"{row.get('title', '')} {summary_text}"
        tags = _detect_tags(row, summary_obj, merged)
        risk = str(row.get("risk_level") or summary_obj.get("risk_level") or "中").strip()
        if risk not in RISK_WEIGHT:
            risk = "中"

        impact = row.get("impact_score", summary_obj.get("impact_score", 0))
        try:
            impact_score = int(float(impact))
        except Exception:
            impact_score = 0

        created_at_raw = str(row.get("created_at") or "")
        candidates.append(
            {
                "id": str(row.get("id") or "").strip(),
                "url": str(row.get("url") or "").strip(),
                "title": _truncate_for_prompt(row.get("title"), 140),
                "source": _truncate_for_prompt(row.get("source"), 50) or "Unknown",
                "summary": _truncate_for_prompt(summary_text or row.get("content"), 380),
                "risk_level": risk,
                "impact_score": max(0, min(100, impact_score)),
                "platform": _truncate_for_prompt(row.get("platform"), 40)
                or _truncate_for_prompt(summary_obj.get("platform"), 40)
                or "Global",
                "region": _truncate_for_prompt(row.get("region"), 40)
                or _truncate_for_prompt(summary_obj.get("region"), 40)
                or "Global",
                "tags": tags,
                "created_at": created_at_raw,
            }
        )

    def relevance_score(item: dict[str, Any]) -> int:
        text = f"{item.get('title', '')} {item.get('summary', '')} {' '.join(item.get('tags') or [])}".lower()
        keys = [
            "merchant",
            "saas",
            "checkout",
            "payment",
            "fulfillment",
            "acquisition",
            "商家",
            "支付",
            "履约",
            "获客",
            "转化",
            "竞争",
        ]
        return sum(1 for key in keys if key in text)

    def parse_created(ts: str) -> float:
        try:
            return datetime.fromisoformat(ts.replace("Z", "+00:00")).timestamp()
        except Exception:
            return 0

    sorted_rows = sorted(
        candidates,
        key=lambda item: (
            RISK_WEIGHT.get(str(item.get("risk_level")), 2),
            int(item.get("impact_score") or 0),
            relevance_score(item),
            parse_created(str(item.get("created_at") or "")),
        ),
        reverse=True,
    )
    return sorted_rows[:MAX_NEWS]


def _style_choice(now_utc: datetime) -> str:
    styles = ["果断型", "谨慎型", "机会型"]
    return styles[(now_utc.hour // 6) % 3]


def _build_prompt(*, input_news: list[dict[str, Any]], style: str, low_sample: bool) -> str:
    low_sample_line = "若当天可用新闻 < 5 条：输出低置信但仍给结论，并在 one_liner 明确“样本少”。"
    if not low_sample:
        low_sample_line = "当天样本充足，请给明确结论并避免空话。"

    return f"""你是独立站建站SaaS公司的战略分析师。仅可基于输入新闻生成公司级结论。

硬性要求：
1) 不要泛泛谈宏观；必须落到商家成本/需求、跨境履约、支付合规、平台生态、竞争格局中的至少一项。
2) headline 必须有结论（<=28字），禁止“需观察/单点风险”这类空话。
3) 写作风格采用：{style}。并避免固定句式重复。
4) 引用必须来自输入新闻 id/url，不允许编造。
5) {low_sample_line}
6) 只输出严格 JSON，不要 Markdown，不要解释。
7) 不允许使用“...”或“…”省略信息，必须输出完整句子。

输出字段必须完整：
{{
  "headline": "...",
  "one_liner": "...",
  "top_drivers": [
    {{"title":"...","why_it_matters":"...","signals":["news_id_or_url"]}}
  ],
  "impacts": {{
    "merchant_demand":"...",
    "acquisition":"...",
    "conversion":"...",
    "payments_risk":"...",
    "fulfillment":"...",
    "competition":"..."
  }},
  "actions": [
    {{"priority":"P0","owner":"战略","timeframe":"24-72h","action":"...","success_metric":"..."}},
    {{"priority":"P1","owner":"产品","timeframe":"1-2w","action":"...","success_metric":"..."}},
    {{"priority":"P2","owner":"商业化","timeframe":"本月","action":"...","success_metric":"..."}}
  ],
  "citations": ["news_id_or_url"],
  "stats": {{"scanned":0,"used":0,"high_risk":0,"high_impact":0}}
}}

输入新闻（JSON）：
{json.dumps(input_news, ensure_ascii=False)}
"""


def _clean_citations(values: Any, input_news: list[dict[str, Any]]) -> list[str]:
    valid_keys: set[str] = set()
    for item in input_news:
        if item.get("id"):
            valid_keys.add(str(item["id"]))
        if item.get("url"):
            valid_keys.add(str(item["url"]))

    out: list[str] = []
    if isinstance(values, list):
        for value in values:
            text = str(value or "").strip()
            if text and text in valid_keys and text not in out:
                out.append(text)

    if len(out) < 3:
        for item in input_news:
            fallback = str(item.get("id") or item.get("url") or "").strip()
            if fallback and fallback not in out:
                out.append(fallback)
            if len(out) >= 3:
                break

    return out[:10]


def _normalize_brief(
    raw: dict[str, Any],
    *,
    input_news: list[dict[str, Any]],
    scanned: int,
    low_sample: bool,
) -> dict[str, Any]:
    headline = _normalize_text(raw.get("headline")) or "外部冲击升温，优先守住支付与履约"
    one_liner = _normalize_text(raw.get("one_liner")) or "跨境成本与平台规则同步变化，先稳支付合规与转化。"
    if low_sample and "样本少" not in one_liner:
        one_liner = _normalize_text(f"{one_liner}（样本少）")

    top_drivers: list[dict[str, Any]] = []
    if isinstance(raw.get("top_drivers"), list):
        for item in raw["top_drivers"][:5]:
            if not isinstance(item, dict):
                continue
            top_drivers.append(
                {
                    "title": _normalize_text(item.get("title")) or "外部信号变化",
                    "why_it_matters": _normalize_text(item.get("why_it_matters")) or "对商家经营和SaaS决策有直接影响。",
                    "signals": _clean_citations(item.get("signals"), input_news)[:3],
                }
            )

    if not top_drivers:
        for item in input_news[:3]:
            top_drivers.append(
                {
                    "title": _normalize_text(item.get("title")) or "外部信号变化",
                    "why_it_matters": _normalize_text(item.get("summary")) or "对商家经营和SaaS决策有直接影响。",
                    "signals": _clean_citations([item.get("id") or item.get("url")], input_news)[:1],
                }
            )

    impacts_raw = raw.get("impacts") if isinstance(raw.get("impacts"), dict) else {}
    impacts = {
        "merchant_demand": _normalize_text(impacts_raw.get("merchant_demand")) or "需求短期受政策与平台动作牵引，需分层判断。",
        "acquisition": _normalize_text(impacts_raw.get("acquisition")) or "投放与渠道成本波动加大，获客效率分化。",
        "conversion": _normalize_text(impacts_raw.get("conversion")) or "转化受支付成功率与价格预期共同影响。",
        "payments_risk": _normalize_text(impacts_raw.get("payments_risk")) or "支付合规与拒付风险需前置处置。",
        "fulfillment": _normalize_text(impacts_raw.get("fulfillment")) or "履约和关税变化可能压缩交付时效。",
        "competition": _normalize_text(impacts_raw.get("competition")) or "头部平台动作提升竞争门槛与迁移成本。",
    }

    actions_raw = raw.get("actions") if isinstance(raw.get("actions"), list) else []
    actions: list[dict[str, Any]] = []
    for item in actions_raw[:6]:
        if not isinstance(item, dict):
            continue
        priority = str(item.get("priority") or "").strip()
        if priority not in {"P0", "P1", "P2"}:
            continue
        owner = _normalize_text(item.get("owner")) or "战略"
        timeframe = _normalize_text(item.get("timeframe")) or {"P0": "24-72h", "P1": "1-2w", "P2": "本月"}[priority]
        action_text = _normalize_text(item.get("action")) or "建立跟踪看板并落地负责人。"
        success_metric = _normalize_text(item.get("success_metric")) or "关键指标环比改善"
        actions.append(
            {
                "priority": priority,
                "owner": owner,
                "timeframe": timeframe,
                "action": action_text,
                "success_metric": success_metric,
            }
        )

    by_priority = {item["priority"]: item for item in actions}
    defaults = {
        "P0": {"priority": "P0", "owner": "战略", "timeframe": "24-72h", "action": "锁定高风险信号并启动跨团队应急同步。", "success_metric": "关键风险处置闭环率"},
        "P1": {"priority": "P1", "owner": "产品", "timeframe": "1-2w", "action": "补齐支付/履约相关产品能力和告警阈值。", "success_metric": "支付成功率与履约时效"},
        "P2": {"priority": "P2", "owner": "商业化", "timeframe": "本月", "action": "按行业分层输出对客策略并验证转化。", "success_metric": "高价值客户转化率"},
    }
    actions = [by_priority.get("P0", defaults["P0"]), by_priority.get("P1", defaults["P1"]), by_priority.get("P2", defaults["P2"])]

    citations = _clean_citations(raw.get("citations"), input_news)
    high_risk = sum(1 for item in input_news if item.get("risk_level") == "高")
    high_impact = sum(1 for item in input_news if int(item.get("impact_score") or 0) >= 75)

    stats_raw = raw.get("stats") if isinstance(raw.get("stats"), dict) else {}
    stats = {
        "scanned": int(stats_raw.get("scanned") or scanned),
        "used": int(stats_raw.get("used") or len(input_news)),
        "high_risk": int(stats_raw.get("high_risk") or high_risk),
        "high_impact": int(stats_raw.get("high_impact") or high_impact),
    }

    return {
        "headline": headline,
        "one_liner": one_liner,
        "top_drivers": top_drivers,
        "impacts": impacts,
        "actions": actions,
        "citations": citations,
        "stats": stats,
    }


def _fallback_brief(input_news: list[dict[str, Any]], scanned: int, low_sample: bool) -> dict[str, Any]:
    top = input_news[:3]
    if top:
        anchor = _normalize_text(top[0].get("title"))
        headline = _normalize_text(f"{anchor}触发策略收缩与防守")
        one_liner = _normalize_text("外部事件正在压缩商家利润与履约弹性，优先稳支付、转化和高风险客户。")
    else:
        headline = "样本偏少，先执行防守型策略"
        one_liner = "当天可用新闻有限，先按支付合规与履约稳定进行保守决策。"

    if low_sample and "样本少" not in one_liner:
        one_liner = _normalize_text(f"{one_liner}（样本少）")

    return _normalize_brief(
        {
            "headline": headline,
            "one_liner": one_liner,
            "top_drivers": [
                {
                    "title": _normalize_text(item.get("title")),
                    "why_it_matters": _normalize_text(item.get("summary")),
                    "signals": [item.get("id") or item.get("url")],
                }
                for item in top
            ],
            "citations": [item.get("id") or item.get("url") for item in top],
        },
        input_news=input_news,
        scanned=scanned,
        low_sample=low_sample,
    )


def generate_daily_brief() -> dict[str, Any]:
    now_utc = datetime.now(timezone.utc)
    brief_date, window_start, window_end = _utc8_window(now_utc)
    raw_rows = fetch_news_raw_for_daily_brief(
        window_start_iso=window_start.isoformat(),
        window_end_iso=window_end.isoformat(),
        limit=FETCH_LIMIT,
    )
    input_news = _build_input_news(raw_rows)
    low_sample = len(input_news) < 5
    style = _style_choice(now_utc)

    prompt = _build_prompt(input_news=input_news, style=style, low_sample=low_sample)
    llm_resp: dict[str, Any] = {}
    brief_payload: dict[str, Any]
    fallback_used = False

    try:
        llm_resp = generate_json_object(
            prompt,
            max_tokens=LLM_MAX_TOKENS,
            temperature=LLM_TEMPERATURE,
            timeout=LLM_TIMEOUT,
        )
        if not llm_resp.get("ok"):
            raise ValueError("LLM JSON parse failed")
        brief_payload = _normalize_brief(
            llm_resp.get("data") if isinstance(llm_resp.get("data"), dict) else {},
            input_news=input_news,
            scanned=len(raw_rows),
            low_sample=low_sample,
        )
    except Exception as exc:
        fallback_used = True
        raw_preview = _truncate_for_prompt(llm_resp.get("raw_text") if isinstance(llm_resp, dict) else "", 400)
        print(f"[DAILY_BRIEF][WARN] fallback used | reason={exc} | raw_preview={raw_preview}")
        brief_payload = _fallback_brief(input_news, scanned=len(raw_rows), low_sample=low_sample)

    row = {
        "brief_date": brief_date,
        "brief_tz": DAILY_BRIEF_TZ,
        "window_start": window_start.isoformat(),
        "window_end": window_end.isoformat(),
        "headline": brief_payload["headline"],
        "one_liner": brief_payload["one_liner"],
        "top_drivers": brief_payload["top_drivers"],
        "impacts": brief_payload["impacts"],
        "actions": brief_payload["actions"],
        "citations": brief_payload["citations"],
        "stats": brief_payload["stats"],
        "model": llm_resp.get("model") if isinstance(llm_resp, dict) else None,
        "prompt_version": PROMPT_VERSION,
        "usage": llm_resp.get("usage") if isinstance(llm_resp, dict) else {},
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }

    inserted: dict[str, Any] = {}
    write_error = ""
    try:
        inserted = upsert_daily_brief(row)
    except Exception as exc:
        write_error = str(exc)
        print(f"[DAILY_BRIEF][ERROR] upsert failed | error={write_error}")
    generated_at = str(inserted.get("generated_at") or row["generated_at"])

    return {
        "brief_date": brief_date,
        "window_start": window_start.isoformat(),
        "window_end": window_end.isoformat(),
        "scanned": len(raw_rows),
        "selected": len(input_news),
        "written": bool(inserted),
        "write_error": write_error,
        "generated_at": generated_at,
        "headline": brief_payload["headline"],
        "one_liner": brief_payload["one_liner"],
        "citations_count": len(brief_payload["citations"]),
        "fallback_used": fallback_used,
    }


def main() -> None:
    result = generate_daily_brief()
    print(f"[DAILY_BRIEF] window_utc8={result['brief_date']} start={result['window_start']} end={result['window_end']}")
    print(f"[DAILY_BRIEF] scanned={result['scanned']} selected={result['selected']}")
    print(
        f"[DAILY_BRIEF] write_ok={result['written']} brief_date={result['brief_date']} generated_at={result['generated_at']}"
    )
    print(f"[DAILY_BRIEF] headline={result['headline']}")
    print(f"[DAILY_BRIEF] one_liner={result['one_liner']}")
    print(f"[DAILY_BRIEF] citations={result['citations_count']} fallback={result['fallback_used']}")
    if result.get("write_error"):
        print(f"[DAILY_BRIEF] write_error={result['write_error']}")


if __name__ == "__main__":
    main()
