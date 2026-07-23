/**
 * 主流模型 token 定价（按 1M tokens，单位：美元）
 * 数据来源：
 *   - DeepSeek: https://api-docs.deepseek.com/zh-cn/quick_start/pricing
 *   - OpenAI:   https://openai.com/api/pricing
 *   - Anthropic: https://www.anthropic.com/pricing
 *   - Google Gemini: https://ai.google.dev/pricing
 *
 * MiniMax 的 usage_summary 返回的是 total_token（不分 input/output）。
 * 用户告诉了一个常用比例：输入 20% / 输出 80%（典型对话 + agent 用量）。
 */

export interface ModelPricing {
  id: string;
  provider: string;
  model: string;
  inputPerMillion: number;   // USD per 1M input tokens
  outputPerMillion: number;  // USD per 1M output tokens
  note?: string;
}

// 价格快照（截至 2026/07），仅供参照
export const MODEL_PRICING: ModelPricing[] = [
  {
    id: "deepseek-v3",
    provider: "DeepSeek",
    model: "DeepSeek-V3",
    inputPerMillion: 0.14,
    outputPerMillion: 0.28,
    note: "缓存命中 $0.014/1M",
  },
  {
    id: "deepseek-r1",
    provider: "DeepSeek",
    model: "DeepSeek-R1",
    inputPerMillion: 0.14,
    outputPerMillion: 2.19,
    note: "推理模型",
  },
  {
    id: "gpt-4o",
    provider: "OpenAI",
    model: "GPT-4o",
    inputPerMillion: 2.5,
    outputPerMillion: 10.0,
    note: "128k 上下文",
  },
  {
    id: "gpt-4o-mini",
    provider: "OpenAI",
    model: "GPT-4o mini",
    inputPerMillion: 0.15,
    outputPerMillion: 0.6,
  },
  {
    id: "claude-sonnet",
    provider: "Anthropic",
    model: "Claude Sonnet 4",
    inputPerMillion: 3.0,
    outputPerMillion: 15.0,
  },
  {
    id: "claude-haiku",
    provider: "Anthropic",
    model: "Claude Haiku 3.5",
    inputPerMillion: 0.8,
    outputPerMillion: 4.0,
  },
  {
    id: "gemini-1.5-pro",
    provider: "Google",
    model: "Gemini 1.5 Pro",
    inputPerMillion: 1.25,
    outputPerMillion: 5.0,
    note: "≤200k context",
  },
  {
    id: "gemini-1.5-flash",
    provider: "Google",
    model: "Gemini 1.5 Flash",
    inputPerMillion: 0.075,
    outputPerMillion: 0.3,
  },
];

// 估算比例：输入 20% / 输出 80%
export const DEFAULT_INPUT_RATIO = 0.2;
export const DEFAULT_OUTPUT_RATIO = 0.8;

// 美元 → 人民币固定汇率（参考 2026/07，可调整）
export const USD_TO_CNY = 7.2;

/**
 * 按 input/output 比例拆分总额，算出某模型理论花费（美元）
 */
export function estimateCost(
  totalTokens: number,
  pricing: ModelPricing,
  inputRatio = DEFAULT_INPUT_RATIO
): number {
  if (totalTokens <= 0) return 0;
  const outputRatio = 1 - inputRatio;
  const inputCost = (totalTokens * inputRatio) / 1e6 * pricing.inputPerMillion;
  const outputCost = (totalTokens * outputRatio) / 1e6 * pricing.outputPerMillion;
  return inputCost + outputCost;
}

/**
 * 格式化人民币（带单位：元 / 万 / 亿）
 *   - < 1000：    533.13 → "¥533.13"
 *   - < 10000：   5500   → "¥5,500"
 *   - < 1e7：     15000  → "¥1.50 万"
 *   - < 1e9：     1.5e7  → "¥1500 万"
 *   - >= 1e9：    1.5e9  → "¥15.0 亿"
 */
export function formatCNY(value: number): string {
  if (value === 0) return "¥0";
  const abs = Math.abs(value);
  if (abs < 1000) return `¥${value.toFixed(2)}`;
  if (abs < 1e4) return `¥${value.toLocaleString("zh-CN", { maximumFractionDigits: 2 })}`;
  if (abs < 1e7) return `¥${(value / 1e4).toFixed(2)} 万`;
  if (abs < 1e9) return `¥${(value / 1e4).toFixed(0)} 万`;
  return `¥${(value / 1e8).toFixed(2)} 亿`;
}

/** 美元价 → 人民币价（用 USD_TO_CNY 换算） */
export function usdToCny(usd: number): number {
  return usd * USD_TO_CNY;
}

/** 兼容旧名：formatUSD → 实际输出人民币 */
export function formatUSD(value: number): string {
  return formatCNY(usdToCny(value));
}

/**
 * 把 token 数格式化为 B / M / K
 */
export function formatTokens(value: number): string {
  if (value <= 0) return "0";
  if (value < 1e3) return `${value}`;
  if (value < 1e6) return `${(value / 1e3).toFixed(1)}K`;
  if (value < 1e9) return `${(value / 1e6).toFixed(2)}M`;
  if (value < 1e12) return `${(value / 1e9).toFixed(2)}B`;
  return `${(value / 1e12).toFixed(2)}T`;
}

/**
 * 从 daily_token_usage 数组（按老→新排序）取末尾 N 天的总量
 */
export function sumLastNDays(dailyTokens: number[] | undefined, days: number): number {
  if (!Array.isArray(dailyTokens) || dailyTokens.length === 0) return 0;
  return dailyTokens.slice(-days).reduce((s, v) => s + (v ?? 0), 0);
}

/**
 * 累计调用量（来自 total_token_consumed 字符串，如 "17.70B"）
 */
export function parseBigCount(s: string | undefined): number {
  if (!s) return 0;
  const m = /^([\d.]+)([KMGTB]?)$/.exec(s.trim());
  if (!m) return 0;
  const v = parseFloat(m[1]);
  switch (m[2]) {
    case "K": return v * 1e3;
    case "M": return v * 1e6;
    case "B": return v * 1e9;
    case "T": return v * 1e12;
    default: return v;
  }
}