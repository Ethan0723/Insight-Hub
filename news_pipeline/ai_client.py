"""Claude API client for summary generation."""

from __future__ import annotations

import os

import requests
from dotenv import load_dotenv

load_dotenv()

CLAUDE_API_URL = os.getenv("CLAUDE_API_URL", "https://litellm.shoplazza.site/chat/completions")
CLAUDE_API_KEY = os.getenv("CLAUDE_API_KEY", "")
MODEL = "bedrock-claude-4-5-sonnet"

PROMPT_TEMPLATE = """你是一名跨境电商行业战略分析师。

请基于以下新闻内容，输出结构化分析报告，要求逻辑清晰，避免泛泛而谈。

请按照以下结构输出：

一、新闻核心摘要（Core Summary）
- 用3-5句话概括新闻核心事件
- 提炼关键事实、数据或政策变化
- 不做评价，只做客观总结

二、行业影响（Industry Impact）
- 对跨境电商行业的短期影响
- 对行业格局的中长期影响
- 可能改变的竞争结构或商业模式

三、战略提炼（Strategic Insight）
- 对 Shopify / Shoplazza / 平台型SaaS 的启示
- 可能的机会点
- 潜在威胁或风险因素
- 建议的战略应对方向

新闻标题：
{title}

新闻正文：
{content}

请使用中文输出，条理清晰，结构分明。"""



def generate_summary(title: str, content: str) -> str:
    """Call Claude API and return generated summary text."""

    if not CLAUDE_API_KEY:
        raise ValueError("Missing CLAUDE_API_KEY in environment.")

    prompt = PROMPT_TEMPLATE.format(title=title or "", content=content or "")

    headers = {
        "Authorization": f"Bearer {CLAUDE_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.2,
    }

    response = requests.post(CLAUDE_API_URL, headers=headers, json=payload, timeout=60)
    response.raise_for_status()

    data = response.json()

    # Compatible with OpenAI-style response schema used by many LiteLLM gateways.
    choices = data.get("choices", [])
    if not choices:
        raise ValueError("Claude API returned no choices.")

    message = choices[0].get("message", {})
    text = message.get("content", "")

    if isinstance(text, list):
        # Some models may return structured content blocks.
        text = "\n".join(str(block.get("text", "")) for block in text if isinstance(block, dict))

    summary = str(text).strip()
    if not summary:
        raise ValueError("Claude API returned empty summary.")

    return summary
