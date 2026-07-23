// MiniMax Token Plan 原始响应类型
export interface ModelRemainRaw {
  start_time?: number;
  end_time?: number;
  remains_time?: number;
  current_interval_total_count?: number;
  current_interval_usage_count?: number; // 注意：是剩余额度，不是已用
  // 新字段（MiniMax 2026 改版）：剩余百分比 0~100，作为权威来源
  current_interval_remaining_percent?: number;
  current_interval_status?: number;
  model_name?: string;
  current_weekly_total_count?: number;
  current_weekly_usage_count?: number;
  weekly_start_time?: number;
  weekly_end_time?: number;
  weekly_remains_time?: number;
  current_weekly_remaining_percent?: number;
  current_weekly_status?: number;
}

export interface MiniMaxRawPayload {
  base_resp?: {
    status_code?: number;
    status_msg?: string;
  };
  status_code?: number;
  status_msg?: string;
  model_remains?: ModelRemainRaw[];
  // 套餐信息（部分响应里会带顶层字段，命名不统一都试试）
  current_subscribe_title?: string;
  plan_name?: string;
  plan?: string;
}

// 订阅套餐信息
export type PlanTier = "Plus" | "Max" | "Ultra" | "Starter" | "Free" | "Custom";

export interface PlanInfo {
  tier: PlanTier | null;          // 归一化等级（Plus / Max / Ultra 等）
  rawName: string | null;          // API 原始值（如果有）
  source: "explicit" | "inferred" | "unknown";
  priceLabel: string | null;       // "¥49 / 月"（已知档位填）
}

// 给 UI 用的 view model
export interface ModelUsage {
  name: string;
  timeWindow: string;
  totalCount: number | null;          // 旧字段，可能为 0
  remainingCount: number | null;      // 旧字段，可能为 0
  usedCount: number | null;           // 优先用 percent 算
  remainingPercent: number | null;    // 新字段，权威剩余百分比
  usedPercent: number | null;
  weeklyRemainingPercent: number | null;
  weeklyUsedPercent: number | null;
}

export interface UsageViewModel {
  ok: boolean;
  statusLabel: string;
  raw: unknown;
  primaryModelName: string;
  timeWindow: string;
  resetInLabel: string;
  resetTimestamp: number | null;
  // 5h 窗口
  totalCount: number | null;          // 可能为 0（旧字段缺失）
  remainingCount: number | null;      // 同上
  usedCount: number | null;           // = total - remaining，或由 percent 推算
  remainingPercent: number | null;    // 权威剩余 0~100
  usedPercent: number | null;         // 100 - remaining_percent
  // 周窗口
  weeklyTotalCount: number | null;
  weeklyUsedCount: number | null;
  weeklyRemainingCount: number | null;
  weeklyRemainingPercent: number | null;
  weeklyUsedPercent: number | null;
  weeklyResetTimestamp: number | null;
  weeklyResetInLabel: string;
  // 套餐信息
  plan: PlanInfo | null;
  models: ModelUsage[];
}

export type RefreshIntervalMinutes = 1 | 5 | 15 | 30;

// =====================================================
// Dashboard API 数据结构（登录态下的 dashboard 后端接口）
// 来源：https://platform.minimaxi.com/console/usage 页面后端
// 鉴权：cookie (_token=...) + x-group-id header
// =====================================================

export interface DashboardMostActiveDay {
  date: string;             // "2026-07-19"
  token_count: string;      // "990.54M"
  image_count: string;
  video_count: string;
  music_count: string;
  voice_character_count: string;
}

export interface DashboardModelDay {
  model: string;
  input_token: number;
  cache_read_token: number;
  cache_create_token: number;
  output_token: number;
  total_token: number;
  cache_hit_percent: string;
}

export interface DashboardDateModelUsage {
  date: string;             // "2026-02-03"
  models: DashboardModelDay[];
  total_input_token: number;
  total_cache_read_token: number;
  total_cache_create_token: number;
  total_output_token: number;
  total_token: number;
  cache_hit_percent: string;
}

export interface DashboardUsageSummary {
  total_days: number;
  total_token_consumed: string;            // "17.70B"
  usage_ranking_percent: number;           // 百分位排名
  most_active_day: DashboardMostActiveDay;
  active_days: number;
  current_consecutive_days: number;
  // daily_token_usage 按老 → 新 排序（数组最后一个元素是今天的）
  daily_token_usage: number[];
  date_model_usage: DashboardDateModelUsage[];
}

export interface DashboardRemainsModel {
  model_name: string;
  start_time?: number;
  end_time?: number;
  remains_time?: number;              // 毫秒
  current_interval_total_count?: number;
  current_interval_used_count?: number;
  current_interval_remains_count?: number;
  current_interval_used_percent?: string;  // "18%"
  current_interval_total_percent?: string;  // "100%"
  current_interval_status?: number;
  weekly_start_time?: number;
  weekly_end_time?: number;
  weekly_remains_time?: number;
  current_weekly_total_count?: number;
  current_weekly_used_count?: number;
  current_weekly_remains_count?: number;
  current_weekly_used_percent?: string;
  current_weekly_total_percent?: string;
  current_weekly_status?: number;
}

export interface DashboardRemainsResponse {
  model_remains: DashboardRemainsModel[];
  base_resp?: { status_code: number; status_msg: string };
}

export interface DashboardSession {
  // 是否已登录（cookie 是否就绪）
  ready: boolean;
  // 登录时间
  loggedInAt: number | null;
  // 登录的 group_id（用户身份标识，不敏感）
  groupId: string | null;
  // 登录的账户标识（JWT 解码出来的 userId 或 email）
  accountLabel: string | null;
}

// 来源：GET /backend/account/token_plan_credit
export interface TokenPlanCreditBalance {
  total_balance: number;
  buckets: Array<{
    name: string;
    balance: number;
    expires_at?: string;
  }>;
}

export interface TokenPlanCredit {
  total_credits: number;
  used_credits: number;
  remaining_credits: number;
  // dashboard 在 credit 接口里顺手返回当前订阅的标题
  // 例如 "Token Plan · TokenPlanUltra-月度会员" / "按量付费" / "Free Tier"
  current_subscribe_title?: string;
  api_key?: string;          // 这个接口附带返回当前的 subscription key（不展示用）
  balance_breakdown: TokenPlanCreditBalance;
  base_resp?: { status_code: number; status_msg: string };
}

// 当前订阅信息（来自 /v1/api/openplatform/promotion/code_info 或 /billing/subscribe）
// dashboard 通常在 UI 头部展示「Token Plan · TokenPlanUltra-月度会员」
// 字段语义是 miniMax 内部用的，命名不固定
export interface SubscriptionInfo {
  tier: string;                // 归一化：Plus / Max / Ultra 等
  title: string;               // 原始 "Token Plan · TokenPlanUltra-月度会员"
  cycle: "月" | "年" | "其他";  // 计费周期
  expireAt: string | null;     // 到期时间（如果接口给）
}