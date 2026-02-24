# Insight-Hub

## 战略驾驶舱评分逻辑说明

- `Baseline = 外部态势`  
  来源于新闻推理引擎（政策、平台、支付、竞争等信号的聚合评分）。
- `Delta = 策略模拟`  
  来源于收入沙盘参数变化（ARPU、佣金率、支付成功率）的情景扰动值。
- `Final = 决策评分`  
  统一口径为 `Final = clamp(Baseline + Delta, 0..100)`，页面大数字只展示 Final。
- `暴露指数 = 外部风险 × 内部敏感度`  
  外部风险使用 Baseline 归一化；内部敏感度使用 `|Delta|` 归一化；用于优先级排序（P0/P1/P2/P3）。

## 模型架构说明

- 页面主视图为“战略驾驶舱”，承载风险等级、收入暴露矩阵、优先级排序与行动模拟。
- “外部信号引擎（Baseline 计算层）”默认折叠，作为底层可信模型支撑，按需展开查看。
- 架构链路：`外部信号输入 -> Baseline -> 策略参数模拟(Delta) -> Final -> 决策优先级`。

## AI 增强架构说明

- 评分系统仍是规则模型：`Baseline + Delta -> Final`，保持可解释与可复核。
- LLM 仅承担语义理解和表达增强：
  - 自然语言问答（`/api/ai_chat`）
  - 证据新闻聚合摘要（同接口 `task=news_summary`）
- LLM 不参与核心评分计算，不改写 Baseline/Delta/Final。
- 成本控制策略：
  - 流式输出
  - `max_tokens <= 500`
  - `temperature = 0.5`
  - 仅用户主动提问时触发，不随滑杆自动调用

## 本地运行 AI 接口

1. 在终端 A 启动后端：`npm run dev:api`
2. 在终端 B 启动前端：`npm run dev`
3. 在 `.env` 中配置：
   - `LLM_API_KEY=...`
   - 可选：`LLM_API_URL`、`LLM_MODEL`
