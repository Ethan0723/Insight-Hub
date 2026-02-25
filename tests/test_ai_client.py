import unittest

from news_pipeline.ai_client import (
    LLM_EMPTY_TEXT_FALLBACK,
    map_llm_response,
    parse_llm_response,
)


class TestAIClientResponseParsing(unittest.TestCase):
    def test_parse_glm_reasoning_content(self):
        resp = {
            "choices": [
                {
                    "message": {
                        "content": "",
                        "reasoning_content": "这是推理正文",
                    }
                }
            ]
        }
        self.assertEqual(parse_llm_response(resp), "这是推理正文")

    def test_parse_claude_content(self):
        resp = {
            "choices": [
                {
                    "message": {
                        "content": "这是 content 正文",
                    }
                }
            ]
        }
        self.assertEqual(parse_llm_response(resp), "这是 content 正文")

    def test_parse_openai_content_list_blocks(self):
        resp = {
            "choices": [
                {
                    "message": {
                        "content": [
                            {"type": "text", "text": "第一段"},
                            {"type": "text", "text": "第二段"},
                        ]
                    }
                }
            ]
        }
        self.assertEqual(parse_llm_response(resp), "第一段\n第二段")

    def test_parse_unknown_fallback_text(self):
        resp = {
            "choices": [
                {
                    "message": {
                        "content": "",
                        "reasoning_content": "",
                        "raw_text": "兜底字段文本",
                    }
                }
            ]
        }
        self.assertEqual(parse_llm_response(resp), "兜底字段文本")

    def test_map_empty_response_returns_fallback(self):
        resp = {
            "choices": [{"message": {"content": ""}, "finish_reason": "stop"}],
            "usage": {"total_tokens": 12},
        }
        mapped = map_llm_response(resp, provider="zhipu", model="glm-4.5-air")
        self.assertEqual(mapped["text"], LLM_EMPTY_TEXT_FALLBACK)
        self.assertEqual(mapped["provider"], "glm")
        self.assertEqual(mapped["usage"], {"total_tokens": 12})


if __name__ == "__main__":
    unittest.main()
