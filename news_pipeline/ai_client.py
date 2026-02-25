"""LLM client for structured JSON summary generation.

Compatible with:
- OpenAI-compatible chat completions endpoints (e.g. LiteLLM proxy)
- Zhipu BigModel chat completions endpoint
"""

from __future__ import annotations

import json
import os
import re
from typing import Any

import requests
from dotenv import load_dotenv

load_dotenv()

# Backward compatibility:
# - New unified vars: LLM_API_URL / LLM_API_KEY
# - Legacy vars: CLAUDE_API_URL / CLAUDE_API_KEY
LLM_API_URL = os.getenv(
    "LLM_API_URL", os.getenv("CLAUDE_API_URL", "https://litellm.shoplazza.site/chat/completions")
)
LLM_API_KEY = os.getenv("LLM_API_KEY", os.getenv("CLAUDE_API_KEY", ""))
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "auto").strip().lower()  # auto | compatible | zhipu
LLM_MODEL = os.getenv("LLM_MODEL", "").strip()
LLM_MAX_TOKENS = int(os.getenv("LLM_MAX_TOKENS", "900"))
LLM_MAX_INPUT_CHARS = int(os.getenv("LLM_MAX_INPUT_CHARS", "8000"))
LLM_EMPTY_TEXT_FALLBACK = "模型没有生成有效文本，请检查模型配置或进一步降温度/增加 max_tokens。"

MODEL_PROVIDER_MAP = {
    "glm-4.5-air": "glm",
    "glm-4.5": "glm",
    "glm-4-flash": "glm",
    "bedrock-claude-4-5-sonnet": "anthropic",
    "claude-4-5-sonnet": "anthropic",
    "gpt-4o-mini": "openai",
}

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


def _extract_text_value(value: Any) -> str:
    """Extract a normalized text from model field values."""
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, list):
        parts: list[str] = []
        for block in value:
            if isinstance(block, dict):
                text = block.get("text")
                if isinstance(text, str) and text.strip():
                    parts.append(text.strip())
            elif isinstance(block, str) and block.strip():
                parts.append(block.strip())
        return "\n".join(parts).strip()
    return ""


def parse_llm_response(resp: dict[str, Any]) -> str:
    """Parse raw model response into text.

    Priority:
    1) message.content
    2) message.reasoning_content
    3) message.text
    4) message.raw_text / message.generated_text
    """
    first_choice = (resp.get("choices") or [{}])[0]
    message = first_choice.get("message", {}) if isinstance(first_choice, dict) else {}

    for key in ("content", "reasoning_content", "text", "raw_text", "generated_text"):
        parsed = _extract_text_value(message.get(key))
        if parsed:
            return parsed
    return ""


def _resolve_provider_name(provider: str, model: str) -> str:
    if provider == "zhipu":
        return "glm"
    if provider == "compatible":
        return MODEL_PROVIDER_MAP.get(model, "openai-compatible")
    return MODEL_PROVIDER_MAP.get(model, "unknown")


def map_llm_response(resp: dict[str, Any], provider: str, model: str) -> dict[str, Any]:
    """Normalize provider responses to a unified structure for upper layers.

    Returns:
        {
          "text": str,
          "raw_response": dict,
          "provider": str,
          "usage": dict,
          "finish_reason": str | None,
        }
    """
    first_choice = (resp.get("choices") or [{}])[0]
    finish_reason = first_choice.get("finish_reason") if isinstance(first_choice, dict) else None
    usage = resp.get("usage") if isinstance(resp.get("usage"), dict) else {}

    text = parse_llm_response(resp)
    if not text:
        text = LLM_EMPTY_TEXT_FALLBACK

    if finish_reason == "length":
        print("[LLM-WARN] finish_reason=length, output may be truncated.")

    return {
        "text": text,
        "raw_response": resp,
        "provider": _resolve_provider_name(provider, model),
        "usage": usage,
        "finish_reason": finish_reason,
    }


def _detect_provider(url: str) -> str:
    if LLM_PROVIDER in {"compatible", "zhipu"}:
        return LLM_PROVIDER
    if "bigmodel.cn" in (url or ""):
        return "zhipu"
    return "compatible"


def _resolve_endpoint(url: str, provider: str) -> str:
    raw = (url or "").strip()
    if provider == "zhipu":
        if not raw:
            return "https://open.bigmodel.cn/api/paas/v4/chat/completions"
        if raw.endswith("/chat/completions"):
            return raw
        if raw.endswith("/v4"):
            return f"{raw}/chat/completions"
        if raw.endswith("/v4/"):
            return f"{raw}chat/completions"
        return raw

    if not raw:
        return "https://litellm.shoplazza.site/chat/completions"
    return raw


def _resolve_model(provider: str) -> str:
    if LLM_MODEL:
        return LLM_MODEL
    if provider == "zhipu":
        return "glm-4.5"
    return "bedrock-claude-4-5-sonnet"


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


def _prepare_content(content: str) -> str:
    normalized = (content or "").strip()
    if len(normalized) <= LLM_MAX_INPUT_CHARS:
        return normalized
    # Keep prompt size bounded for providers that enforce strict token/length limits.
    return normalized[:LLM_MAX_INPUT_CHARS]


def _build_request_headers(api_key: str) -> dict[str, str]:
    return {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }


def _request_llm_text(
    *,
    endpoint: str,
    provider: str,
    model: str,
    api_key: str,
    prompt: str,
    temperature: float,
    max_tokens: int,
    timeout: int = 60,
) -> tuple[str, dict[str, Any]]:
    headers = _build_request_headers(api_key)
    payload = {
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": temperature,
        "max_tokens": max_tokens,
        "stream": False,
    }

    response = requests.post(endpoint, headers=headers, json=payload, timeout=timeout)
    if response.status_code >= 400:
        body_preview = (response.text or "").strip().replace("\n", " ")[:600]
        raise requests.HTTPError(
            f"{response.status_code} Client Error for url: {endpoint} | body={body_preview}"
        )

    raw = response.json()
    normalized = map_llm_response(raw, provider=provider, model=model)
    return normalized["text"], normalized


def _try_extract_json(text: str) -> dict[str, Any] | None:
    """Try extracting the first JSON-like object from text."""
    if not text:
        return None
    matches = re.findall(r"\{.*?\}", text, flags=re.S)
    for candidate in matches:
        try:
            parsed = json.loads(candidate)
            if isinstance(parsed, dict):
                return parsed
        except Exception:
            continue
    return None


def _repair_json_via_llm(
    *,
    broken_text: str,
    title: str,
    endpoint: str,
    provider: str,
    model: str,
    api_key: str,
) -> dict[str, Any]:
    """Use a second lightweight LLM call to repair invalid JSON output."""
    repair_prompt = (
        "下面文本不是合法 JSON。请转换为严格合法 JSON。"
        "不要 Markdown，不要代码块，不要解释，只输出 JSON 对象。\n\n"
        f"标题：{title}\n"
        "待修复文本：\n"
        f"{broken_text}"
    )

    try:
        repaired_text, _ = _request_llm_text(
            endpoint=endpoint,
            provider=provider,
            model=model,
            api_key=api_key,
            prompt=repair_prompt,
            temperature=0.0,
            max_tokens=600,
            timeout=60,
        )
    except Exception:
        return _default_payload("JSON 修复失败")

    clean_repaired = _strip_code_fence(repaired_text)
    try:
        repaired_json = json.loads(clean_repaired)
        if isinstance(repaired_json, dict):
            return repaired_json
    except Exception:
        pass

    extracted = _try_extract_json(clean_repaired)
    if extracted is not None:
        return extracted
    return _default_payload("JSON 修复失败")


def generate_summary(title: str, content: str) -> dict[str, Any]:
    """Call configured LLM endpoint and return normalized structured JSON summary."""

    if not LLM_API_KEY:
        raise ValueError("Missing LLM_API_KEY in environment.")

    provider = _detect_provider(LLM_API_URL)
    endpoint = _resolve_endpoint(LLM_API_URL, provider)
    model = _resolve_model(provider)
    prepared_content = _prepare_content(content)

    # PROMPT_TEMPLATE contains many JSON braces; avoid str.format() to prevent
    # accidental placeholder parsing for fields like "tldr".
    prompt = PROMPT_TEMPLATE.replace("{title}", title or "").replace("{content}", prepared_content)

    text, _ = _request_llm_text(
        endpoint=endpoint,
        provider=provider,
        model=model,
        api_key=LLM_API_KEY,
        prompt=prompt,
        temperature=0.1,
        max_tokens=LLM_MAX_TOKENS,
        timeout=60,
    )
    if text == LLM_EMPTY_TEXT_FALLBACK:
        return _default_payload("模型没有返回有效文本")

    clean_text = _strip_code_fence(text)
    raw_json: dict[str, Any] | None = None

    try:
        parsed = json.loads(clean_text)
        if isinstance(parsed, dict):
            raw_json = parsed
    except Exception:
        raw_json = None

    if raw_json is None:
        print("[LLM-WARN] direct JSON parse failed, trying extract-first-object fallback.")
        raw_json = _try_extract_json(clean_text)

    if raw_json is None:
        print("[LLM-WARN] JSON extraction failed, trying LLM repair pass.")
        repaired = _repair_json_via_llm(
            broken_text=clean_text,
            title=title,
            endpoint=endpoint,
            provider=provider,
            model=model,
            api_key=LLM_API_KEY,
        )
        if isinstance(repaired, dict) and "tldr" in repaired:
            raw_json = repaired
        elif isinstance(repaired, dict):
            raw_json = repaired

    if not isinstance(raw_json, dict):
        return _default_payload("模型未返回合法 JSON")

    return _normalize_payload(raw_json, title, content)
