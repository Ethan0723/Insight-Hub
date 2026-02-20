"""Claude API client for summary generation."""

from __future__ import annotations

import os

import requests
from dotenv import load_dotenv

load_dotenv()

CLAUDE_API_URL = os.getenv("CLAUDE_API_URL", "https://litellm.shoplazza.site/chat/completions")
CLAUDE_API_KEY = os.getenv("CLAUDE_API_KEY", "")
MODEL = "bedrock-claude-4-5-sonnet"

PROMPT_TEMPLATE = """你是一名专注跨境电商SaaS平台战略的行业分析师。

请基于以下新闻内容，输出结构化战略分析报告。

请严格按照以下结构输出：

一、新闻核心摘要（Core Summary）
- 用3-5句话概括新闻核心事实
- 提炼关键数据、政策变化、市场趋势或公司动态
- 保持客观，不做评价

二、行业结构影响（Industry Structure Impact）
- 该事件对跨境电商行业的短期影响
- 对行业格局、竞争结构、利润分配逻辑的中长期影响
- 是否可能改变流量、支付、物流、平台规则或卖家生态

三、平台型SaaS战略启示（Platform SaaS Insight）
请重点从 Shopify / Shoplazza / 独立站SaaS 视角分析：
- 对平台流量结构的影响
- 对商家增长路径的影响
- 对平台收入结构（订阅费/佣金/支付/广告）的影响
- 是否存在产品能力升级机会
- 潜在风险点

四、机会与威胁评估（Opportunities & Risks）
- 新机会方向（例如新市场、新能力、新产品）
- 潜在威胁（政策风险、竞争加剧、利润压缩等）

五、影响强度评级（Impact Score）
- 行业冲击强度（1-5分）
- 平台战略重要性（1-5分）
- 简要说明原因

新闻标题：
{title}

新闻正文：
{content}

请用中文输出，条理清晰，避免空泛表达。
分析应基于新闻内容展开，而非泛泛行业常识。"""



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
