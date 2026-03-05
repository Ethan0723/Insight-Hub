from __future__ import annotations

import json
import os
import re
from difflib import SequenceMatcher
from datetime import datetime, timedelta, timezone
from typing import Any

from .ai_client import generate_json_object
from .supabase_client import fetch_latest_daily_brief_by_date, fetch_news_raw_for_daily_brief, upsert_daily_brief

UTC8 = timezone(timedelta(hours=8))
PROMPT_VERSION = os.getenv("DAILY_BRIEF_PROMPT_VERSION", "v1")
DAILY_BRIEF_TZ = os.getenv("DAILY_BRIEF_TZ", "Asia/Shanghai")
MAX_NEWS = int(os.getenv("DAILY_BRIEF_MAX_NEWS", "50"))
FETCH_LIMIT = int(os.getenv("DAILY_BRIEF_FETCH_LIMIT", "120"))
LLM_MAX_TOKENS = int(os.getenv("DAILY_BRIEF_MAX_TOKENS", os.getenv("LLM_MAX_TOKENS", "1500")))
LLM_TEMPERATURE = float(os.getenv("DAILY_BRIEF_TEMPERATURE", "0.2"))
LLM_TIMEOUT = int(os.getenv("DAILY_BRIEF_TIMEOUT_SEC", "90"))
QUALITY_GUARD_DELTA = int(os.getenv("DAILY_BRIEF_QUALITY_GUARD_DELTA", "5"))

RISK_WEIGHT = {"高": 3, "中": 2, "低": 1}
_DISALLOWED_TERMS = ("样本少", "无关业务", "需观察", "新闻不足", "单点风险")


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


def _topic_hint(input_news: list[dict[str, Any]]) -> str:
    text = " ".join(
        f"{str(item.get('title') or '')} {str(item.get('summary') or '')}".lower()
        for item in (input_news or [])[:8]
    )
    topic_rules = [
        ("tariff", "关税"),
        ("tax", "税费"),
        ("fraud", "欺诈"),
        ("return", "退货"),
        ("payment", "支付"),
        ("checkout", "支付转化"),
        ("logistics", "履约"),
        ("shipping", "履约"),
        ("ai agent", "AI代理"),
        ("agent", "AI代理"),
        ("ecommerce", "电商需求"),
        ("import", "跨境进口"),
    ]
    topics = [zh for en, zh in topic_rules if en in text]
    if not topics:
        return "外部需求与支付链路"
    dedup: list[str] = []
    for t in topics:
        if t not in dedup:
            dedup.append(t)
    return "、".join(dedup[:2])


def _strip_disallowed_terms(text: str) -> str:
    cleaned = text or ""
    for term in _DISALLOWED_TERMS:
        cleaned = cleaned.replace(term, "")
    cleaned = " ".join(cleaned.split())
    return cleaned.strip("，。；：:,. ")


def _has_cjk(text: str) -> bool:
    return any("\u4e00" <= ch <= "\u9fff" for ch in str(text or ""))


def _is_english_heavy(text: str) -> bool:
    s = str(text or "")
    if not s.strip():
        return False
    latin = sum(1 for ch in s if ("a" <= ch.lower() <= "z"))
    cjk = sum(1 for ch in s if "\u4e00" <= ch <= "\u9fff")
    return latin >= 12 and cjk <= 8


def _cn_or_fallback(text: str, fallback: str, *, strict_cn: bool = False) -> str:
    cleaned = _strip_disallowed_terms(_normalize_text(text))
    if not cleaned:
        return fallback
    if strict_cn and _is_english_heavy(cleaned) and not _has_cjk(cleaned):
        return fallback
    return cleaned


def _norm_for_similarity(text: str) -> str:
    lowered = str(text or "").lower()
    lowered = re.sub(r"https?://\S+", " ", lowered)
    lowered = re.sub(r"[^a-z0-9\u4e00-\u9fff]+", "", lowered)
    return lowered.strip()


def _headline_too_close_to_news(headline: str, input_news: list[dict[str, Any]]) -> bool:
    h = _norm_for_similarity(headline)
    if not h:
        return True

    # 强约束：英文重、或引号新闻句式，直接判为风险标题
    if _is_english_heavy(headline):
        return True
    if any(q in str(headline or "") for q in ("'", '"', "“", "”", "CEO")) and len(h) >= 12:
        return True

    for item in input_news[:10]:
        title = _norm_for_similarity(str(item.get("title") or ""))
        if not title:
            continue
        if h in title or title in h:
            return True
        ratio = SequenceMatcher(None, h, title).ratio()
        if ratio >= 0.62:
            return True
    return False


def _rewrite_headline_if_needed(headline: str, one_liner: str, input_news: list[dict[str, Any]]) -> str:
    cleaned = _strip_disallowed_terms(_normalize_text(headline))
    if not cleaned:
        return "外部信号分散，先执行可逆验证策略"
    if _is_english_heavy(cleaned) and not _has_cjk(cleaned):
        base = _strip_disallowed_terms(_normalize_text(one_liner))
        if base:
            base = base.replace("。", "").replace("，", " ")
            if len(base) > 20:
                base = base[:20].rstrip()
            return f"{base}，先做可逆验证"
        return "外部变量波动上升，先做可逆验证"
    if cleaned.startswith("外部信号分散"):
        base = _strip_disallowed_terms(_normalize_text(one_liner))
        if base:
            base = base.replace("。", "").replace("，", " ")
            if len(base) > 20:
                base = base[:20].rstrip()
            return f"{base}，先做可逆验证"
        if input_news:
            seed = _normalize_text(input_news[0].get("title"))
            if seed:
                seed = re.sub(r"[^A-Za-z0-9\u4e00-\u9fff]+", " ", seed).strip()
                if len(seed) > 16:
                    seed = seed[:16].rstrip()
                return f"{seed}带来经营扰动，先做可逆验证"
    if not _headline_too_close_to_news(cleaned, input_news):
        return cleaned

    base = _strip_disallowed_terms(_normalize_text(one_liner))
    if base:
        # 从解释句抽象成“结论句”，避免复制新闻标题
        base = base.replace("。", "").replace("，", " ")
        if len(base) > 24:
            base = base[:24].rstrip()
        return f"{base}，先做可逆验证".strip("， ")
    return "外部信号未成单一主线，先做可逆验证"


def _as_dict(value: Any) -> dict[str, Any]:
    if isinstance(value, dict):
        return value
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
            return parsed if isinstance(parsed, dict) else {}
        except Exception:
            return {}
    return {}


def _as_list(value: Any) -> list[Any]:
    if isinstance(value, list):
        return value
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
            return parsed if isinstance(parsed, list) else []
        except Exception:
            return []
    return []


def _quality_score(brief_payload: dict[str, Any], input_news: list[dict[str, Any]]) -> int:
    stats = _as_dict(brief_payload.get("stats"))
    used = int(stats.get("used") or 0)
    high_impact = int(stats.get("high_impact") or 0)
    high_risk = int(stats.get("high_risk") or 0)

    citations = _as_list(brief_payload.get("citations"))
    valid_keys = set()
    for n in input_news:
        nid = str(n.get("id") or "").strip()
        nurl = str(n.get("url") or "").strip()
        if nid:
            valid_keys.add(nid)
        if nurl:
            valid_keys.add(nurl)
    linked = sum(1 for c in citations if str(c or "").strip() in valid_keys)

    actions = _as_list(brief_payload.get("actions"))
    has_p = {"P0": False, "P1": False, "P2": False}
    action_filled = 0
    for a in actions:
        if not isinstance(a, dict):
            continue
        p = str(a.get("priority") or "").strip()
        if p in has_p:
            has_p[p] = True
        if str(a.get("action") or "").strip():
            action_filled += 1

    impacts = _as_dict(brief_payload.get("impacts"))
    impact_fields = ["merchant_demand", "acquisition", "conversion", "payments_risk", "fulfillment", "competition"]
    impact_filled = sum(1 for k in impact_fields if str(impacts.get(k) or "").strip())

    headline = str(brief_payload.get("headline") or "").strip()
    one_liner = str(brief_payload.get("one_liner") or "").strip()

    signal_score = min(used, 10) / 10 * 15 + min(high_impact, 5) / 5 * 15 + min(high_risk, 3) / 3 * 10
    evidence_score = min(len(citations), 6) / 6 * 15 + (linked / max(1, len(citations))) * 10
    action_score = (sum(1 for v in has_p.values() if v) / 3) * 12 + min(action_filled, 3) / 3 * 8 + (impact_filled / 6) * 5
    text_score = 10 if headline and one_liner else 0

    penalty = 0.0
    if _headline_too_close_to_news(headline, input_news):
        penalty += 8.0
    if headline.startswith("外部信号分散"):
        penalty += 4.0

    final_score = max(0, min(100, round(signal_score + evidence_score + action_score + text_score - penalty)))
    return int(final_score)


def _extract_existing_quality(existing_row: dict[str, Any]) -> int:
    stats = _as_dict(existing_row.get("stats"))
    q = stats.get("quality_score")
    try:
        return int(q)
    except Exception:
        return 0


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
    return f"""你是独立站建站SaaS公司的战略分析师。仅可基于输入新闻生成公司级结论（面向管理层的“今日战略卡”）。

【目标】
- 输出必须“有结论、可执行、可落地”，即使当天新闻很少或不相关，也要给出“噪声日/常态日”的策略结论与最小动作。
- 不允许通过“样本少/无关/需观察”来弱化结论质量。

【硬性要求】
1) 禁止泛泛谈宏观；必须落到以下至少一项：商家成本/需求、跨境履约、支付合规、平台生态、竞争格局。
2) headline 必须是明确公司级结论（<=28字）。禁止出现：需观察/单点风险/样本少/无关业务/新闻不足 等“自我否定”措辞。
3) one_liner 用 1 句话说明“为什么现在要做/不做什么”，必须可被业务理解（避免技术词、避免空话）。
4) 写作风格采用：{style}，避免固定句式重复；用“判断+依据+动作”写法。
5) 引用必须来自输入新闻的 id 或 url（signals/citations 只能从输入里选），不允许编造。
6) 只输出严格 JSON，不要 Markdown，不要解释。
7) 不允许使用“...”或“…”省略信息，必须输出完整句子。
8) headline 禁止直接复用输入新闻标题、引号原句或人物原话（如 CEO 原话）；必须抽象成“公司动作导向结论”。

【低样本/低相关日处理规则（非常重要）】
- 即使可用新闻很少或相关性低，也必须输出“噪声日结论”而不是“样本少”。
- 允许的表达方式示例（仅示例，不要照抄）：
  - “外部无明确新冲击，优先用内部指标验证趋势”
  - “外部信号分散，采取最小可逆动作 + 加密监控”
- 低样本信息只能体现在 stats 字段里（scanned/used/high_risk/high_impact），不得出现在 headline/one_liner/top_drivers/impacts/actions 的正文中。

【输出字段必须完整】
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

【选择新闻与驱动的约束】
- top_drivers 必须 3 条；若相关新闻不足，可用“行业信号/风险机制”作 driver，但 signals 仍需绑定到输入新闻（选最接近的3条作为佐证）。
- impacts 六项必须都写：如果当天缺少直接证据，也必须给“无新增冲击/维持基线 + 需要验证的内部指标”这种可执行表达（不得写空、不准写需观察）。

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
    raw_headline = _cn_or_fallback(
        _normalize_text(raw.get("headline")),
        "外部信号分散，执行最小可逆策略并加密验证",
        strict_cn=True,
    )
    one_liner = _strip_disallowed_terms(_normalize_text(raw.get("one_liner"))) or "外部冲击尚不集中，先以低成本动作验证需求、支付和履约关键指标。"
    headline = _rewrite_headline_if_needed(raw_headline, one_liner, input_news)

    top_drivers: list[dict[str, Any]] = []
    if isinstance(raw.get("top_drivers"), list):
        for item in raw["top_drivers"][:3]:
            if not isinstance(item, dict):
                continue
            candidate_title = _normalize_text(item.get("title"))
            if candidate_title.startswith("外部信号变化") and len(input_news) > len(top_drivers):
                candidate_title = _normalize_text(input_news[len(top_drivers)].get("title"))
            top_drivers.append(
                {
                    "title": _cn_or_fallback(
                        candidate_title,
                        f"外部信号变化{len(top_drivers) + 1}",
                    ),
                    "why_it_matters": _cn_or_fallback(
                        _normalize_text(item.get("why_it_matters")),
                        "该信号会影响商家投入节奏，需要先做小规模验证并保留可逆动作。",
                    ),
                    "signals": _clean_citations(item.get("signals"), input_news)[:3],
                }
            )

    if not top_drivers:
        for item in input_news[:3]:
            top_drivers.append(
                {
                    "title": _cn_or_fallback(_normalize_text(item.get("title")), f"关键信号{len(top_drivers) + 1}"),
                    "why_it_matters": _cn_or_fallback(
                        _normalize_text(item.get("summary")),
                        "暂无集中冲击，先监测核心指标并执行最小可逆动作。",
                    ),
                    "signals": _clean_citations([item.get("id") or item.get("url")], input_news)[:1],
                }
            )

    while len(top_drivers) < 3:
        evidence = input_news[min(len(top_drivers), max(len(input_news) - 1, 0))] if input_news else {}
        top_drivers.append(
            {
                "title": f"机制信号{len(top_drivers) + 1}",
                "why_it_matters": "外部信号分散，先用最小动作验证转化与支付指标，再决定是否扩大投入。",
                "signals": _clean_citations([evidence.get("id") or evidence.get("url")], input_news)[:1],
            }
        )

    impacts_raw = raw.get("impacts") if isinstance(raw.get("impacts"), dict) else {}
    impacts = {
        "merchant_demand": _strip_disallowed_terms(_normalize_text(impacts_raw.get("merchant_demand")))
        or "无新增集中冲击，维持需求基线；本周验证新客询盘率与活跃商家开店转化。",
        "acquisition": _strip_disallowed_terms(_normalize_text(impacts_raw.get("acquisition")))
        or "渠道成本暂无结构性突变，维持投放基线；先小范围测试高意图词包并观察CAC回收周期。",
        "conversion": _strip_disallowed_terms(_normalize_text(impacts_raw.get("conversion")))
        or "转化侧保持基线策略，优先验证结算页完成率与关键路径流失点，再决定是否改版。",
        "payments_risk": _strip_disallowed_terms(_normalize_text(impacts_raw.get("payments_risk")))
        or "支付风险无新增高压事件，保留双通道路由并跟踪成功率、拒付率和风控误杀率。",
        "fulfillment": _strip_disallowed_terms(_normalize_text(impacts_raw.get("fulfillment")))
        or "履约链路暂无新冲击，维持当前承运配置；每日复核妥投时效与异常订单占比。",
        "competition": _strip_disallowed_terms(_normalize_text(impacts_raw.get("competition")))
        or "竞争面暂未出现确定性变盘，先执行可逆差异化动作并监测试点商家留存。",
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
    topic = _topic_hint(input_news)
    headline = f"{topic}波动加剧，先做可逆验证与预案"
    one_liner = f"当日信号主要集中在{topic}，先用低成本试点验证需求、支付与履约指标，再决定是否扩大投入。"

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

    new_quality = _quality_score(brief_payload, input_news)
    row["stats"] = {**_as_dict(row.get("stats")), "quality_score": new_quality}

    inserted: dict[str, Any] = {}
    write_error = ""
    skipped_by_quality_guard = False
    existing_quality = 0
    try:
        existing = fetch_latest_daily_brief_by_date(brief_date=brief_date, prompt_version=PROMPT_VERSION)
        if existing:
            existing_quality = _extract_existing_quality(existing)
            if existing_quality >= new_quality + QUALITY_GUARD_DELTA:
                skipped_by_quality_guard = True
                inserted = existing
            else:
                inserted = upsert_daily_brief(row)
        else:
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
        "quality_score": new_quality,
        "existing_quality": existing_quality,
        "skipped_by_quality_guard": skipped_by_quality_guard,
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
    print(
        f"[DAILY_BRIEF] quality=new:{result['quality_score']} old:{result['existing_quality']} skipped={result['skipped_by_quality_guard']}"
    )
    if result.get("write_error"):
        print(f"[DAILY_BRIEF] write_error={result['write_error']}")


if __name__ == "__main__":
    main()
