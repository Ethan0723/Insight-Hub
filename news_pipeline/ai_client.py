"""Claude API client for structured JSON summary generation."""

from __future__ import annotations

import json
import os
from typing import Any

import requests
from dotenv import load_dotenv

load_dotenv()

LLM_API_URL = os.getenv("LLM_API_URL", os.getenv("CLAUDE_API_URL", "https://litellm.shoplazza.site/chat/completions"))
LLM_API_KEY = os.getenv("LLM_API_KEY", os.getenv("CLAUDE_API_KEY", ""))
MODEL = "bedrock-claude-4-5-sonnet"

PROMPT_TEMPLATE = """你是一名专注跨境电商SaaS平台战略的行业分析师。

请基于以下新闻内容，输出严格 JSON（不要 Markdown，不要代码块，不要额外解释）。

输出 JSON 必须严格包含以下字段，且字段必须存在：
{
  "title_zh": "新闻中文标题（简洁准确，不超过40字）",
  "tldr": "一句话战略判断（<=120字）",
  "impact_score": 0,
  "risk_level": "低",
  "platform": "Global",
  "region": "Global",
  "dimensions": {
    "subscription": {"impact": "无", "analysis": ""},
    "commission": {"impact": "无", "analysis": ""},
    "payment": {"impact": "无", "analysis": ""},
    "ecosystem": {"impact": "无", "analysis": ""}
  },
  "strategic_actions": [
    {"priority": "P1", "owner": "战略", "action": ""}
  ],
  "tags": ["平台"]
}

约束：
1) risk_level 只能是：低/中/高
2) platform 只能是：Shopify/Shopline/Amazon/TikTok Shop/Global
3) region 只能是：US/EU/SEA/UK/Global
4) dimensions 必须包含 subscription/commission/payment/ecosystem 四项
5) dimensions.*.impact 只能是：高/中/低/无
6) strategic_actions.priority 只能是：P0/P1/P2
7) strategic_actions.owner 只能是：产品/战略/商业化
8) 仅输出合法 JSON

特别规则：如果正文信息不足，请降低 impact_score，并在 tldr 中简要说明原因（例如“信息不足，判断置信度较低”）。

新闻标题：
{title}

新闻正文：
{content}
"""

_ALLOWED_RISK = {"低", "中", "高"}
_ALLOWED_PLATFORM = {"Shopify", "Shopline", "Amazon", "TikTok Shop", "Global"}
_ALLOWED_REGION = {"US", "EU", "SEA", "UK", "Global"}
_ALLOWED_IMPACT = {"高", "中", "低", "无"}
_ALLOWED_PRIORITY = {"P0", "P1", "P2"}
_ALLOWED_OWNER = {"产品", "战略", "商业化"}



def _extract_response_text(data: dict[str, Any]) -> str:
    choices = data.get("choices", [])
    if not choices:
        raise ValueError("Claude API returned no choices.")

    message = choices[0].get("message", {})
    content = message.get("content", "")

    if isinstance(content, list):
        content = "\n".join(str(block.get("text", "")) for block in content if isinstance(block, dict))

    text = str(content).strip()
    if not text:
        raise ValueError("Claude API returned empty content.")

    return text



def _strip_code_fence(text: str) -> str:
    stripped = text.strip()
    if stripped.startswith("```"):
        stripped = stripped.strip("`")
        if stripped.lower().startswith("json"):
            stripped = stripped[4:]
    return stripped.strip()



def _default_payload(reason: str) -> dict[str, Any]:
    return {
        "title_zh": "（待翻译）",
        "tldr": f"信息不足，判断置信度较低。原因：{reason}",
        "impact_score": 25,
        "risk_level": "低",
        "platform": "Global",
        "region": "Global",
        "dimensions": {
            "subscription": {"impact": "无", "analysis": "信息不足"},
            "commission": {"impact": "无", "analysis": "信息不足"},
            "payment": {"impact": "无", "analysis": "信息不足"},
            "ecosystem": {"impact": "无", "analysis": "信息不足"},
        },
        "strategic_actions": [
            {"priority": "P2", "owner": "战略", "action": "补充更多一手信息后再做策略判断"}
        ],
        "tags": ["信息不足"],
    }



def _normalize_payload(payload: dict[str, Any], title: str, content: str) -> dict[str, Any]:
    result = _default_payload("模型输出缺失字段")

    result["title_zh"] = str(payload.get("title_zh") or title or result["title_zh"])[:40]
    result["tldr"] = str(payload.get("tldr") or result["tldr"])[:120]

    score = payload.get("impact_score", result["impact_score"])
    try:
        score = int(score)
    except Exception:
        score = result["impact_score"]
    score = max(0, min(100, score))

    if len((content or "").strip()) < 120:
        score = min(score, 30)
        if "信息不足" not in result["tldr"]:
            result["tldr"] = f"{result['tldr']}（信息不足，判断置信度较低）"[:120]

    result["impact_score"] = score

    risk = str(payload.get("risk_level", result["risk_level"]))
    result["risk_level"] = risk if risk in _ALLOWED_RISK else "中"

    platform = str(payload.get("platform", result["platform"]))
    result["platform"] = platform if platform in _ALLOWED_PLATFORM else "Global"

    region = str(payload.get("region", result["region"]))
    result["region"] = region if region in _ALLOWED_REGION else "Global"

    dims = payload.get("dimensions", {}) if isinstance(payload.get("dimensions"), dict) else {}
    normalized_dims: dict[str, dict[str, str]] = {}
    for key in ["subscription", "commission", "payment", "ecosystem"]:
        raw = dims.get(key, {}) if isinstance(dims.get(key), dict) else {}
        impact = str(raw.get("impact", "无"))
        if impact not in _ALLOWED_IMPACT:
            impact = "无"
        analysis = str(raw.get("analysis", "")) or ""
        normalized_dims[key] = {"impact": impact, "analysis": analysis}
    result["dimensions"] = normalized_dims

    actions = payload.get("strategic_actions", [])
    normalized_actions = []
    if isinstance(actions, list):
        for action in actions:
            if not isinstance(action, dict):
                continue
            priority = str(action.get("priority", "P2"))
            owner = str(action.get("owner", "战略"))
            text = str(action.get("action", "")).strip()
            if priority not in _ALLOWED_PRIORITY:
                priority = "P2"
            if owner not in _ALLOWED_OWNER:
                owner = "战略"
            if not text:
                continue
            normalized_actions.append({"priority": priority, "owner": owner, "action": text})

    if not normalized_actions:
        normalized_actions = result["strategic_actions"]
    result["strategic_actions"] = normalized_actions

    tags = payload.get("tags", [])
    if isinstance(tags, list):
        result["tags"] = [str(t) for t in tags if str(t).strip()][:12] or result["tags"]

    return result



def generate_summary(title: str, content: str) -> dict[str, Any]:
    """Call Claude API and return normalized structured JSON summary."""

    if not LLM_API_KEY:
        raise ValueError("Missing LLM_API_KEY in environment.")

    # PROMPT_TEMPLATE contains many JSON braces; avoid str.format() to prevent
    # accidental placeholder parsing for fields like "tldr".
    prompt = (
        PROMPT_TEMPLATE.replace("{title}", title or "").replace("{content}", content or "")
    )

    headers = {
        "Authorization": f"Bearer {LLM_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.1,
    }

    response = requests.post(LLM_API_URL, headers=headers, json=payload, timeout=60)
    response.raise_for_status()

    text = _extract_response_text(response.json())
    clean_text = _strip_code_fence(text)

    try:
        raw_json = json.loads(clean_text)
        if not isinstance(raw_json, dict):
            raise ValueError("Model output is not a JSON object")
    except Exception:
        return _default_payload("模型未返回合法 JSON")

    return _normalize_payload(raw_json, title, content)
