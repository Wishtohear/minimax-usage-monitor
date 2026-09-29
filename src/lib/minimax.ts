import type {
  MiniMaxRawPayload,
  ModelRemainRaw,
  ModelUsage,
  UsageViewModel,
  PlanInfo,
  PlanTier,
} from "@/types/usage";

const REMAINS_ENDPOINT =
  "https://www.minimax.cn/v1/api/openplatform/coding_plan/remains";

const REQUEST_TIMEOUT_MS = 15_000;

export function validateApiKey(apiKey: string): { ok: boolean; message: string } {
  const trimmed = apiKey.trim();
  if (!trimmed) return { ok: false, message: "缺少 API Key" };
  if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
    return { ok: false, message: "API Key 格式无效" };
  }
  if (trimmed.length < 10) return { ok: false, message: "API Key 长度不足" };
  return { ok: true, message: "" };
}

// —— 格式化工具（按 UTC+8 显示） ——
const dateTimeFormatter = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
const timeFormatter = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function formatDateTime(ts: number): string {
  return dateTimeFormatter.format(ts).replace(/\//g, "-");
}
function formatTime(ts: number): string {
  return timeFormatter.format(ts);
}
function formatResetIn(ms: number): string {
  const totalSeconds = Math.max(Math.ceil(ms / 1000), 0);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

// —— 套餐信息解析 ——
// MiniMax 公开套餐等级（参考 https://platform.minimax.cn/subscribe/token-plan）
const PLAN_PRICE_MAP: Record<PlanTier, string> = {
  Plus: "¥49 / 月",
  Max: "¥119 / 月",
  Ultra: "¥469 / 月",
  Starter: "已停售",
  Free: "免费",
  Custom: "自定义",
};

// 5h 窗口总额度 → 反推套餐等级（参考官网文档：Plus ≈ 1500 / Max ≈ 4500 / Ultra ≈ 15000）
const PLAN_TIER_BY_QUOTA: Array<{ tier: PlanTier; minTotal: number }> = [
  { tier: "Ultra", minTotal: 10000 },
  { tier: "Max", minTotal: 3000 },
  { tier: "Plus", minTotal: 1000 },
  { tier: "Starter", minTotal: 1 },
];

function normalizeTier(raw: string): PlanTier | null {
  const s = raw.trim();
  if (/ultra/i.test(s)) return "Ultra";
  if (/max/i.test(s)) return "Max";
  if (/plus/i.test(s)) return "Plus";
  if (/starter/i.test(s)) return "Starter";
  if (/free/i.test(s)) return "Free";
  if (/custom|enterprise|team/i.test(s)) return "Custom";
  return null;
}

/**
 * 从 API 响应 + primary model 反推套餐等级
 * 来源优先级：
 *   1. 顶层 current_subscribe_title / plan_name / plan（最权威）
 *   2. 5h 窗口的 total count 反推（兜底，不返回时用）
 *   3. 都没有 → unknown
 */
export function resolvePlanInfo(
  payload: MiniMaxRawPayload | null,
  primary: ModelRemainRaw | null
): PlanInfo {
  // Step 1: 尝试 API 顶层字段（命名各异都试一下）
  const candidates = [
    payload?.current_subscribe_title,
    payload?.plan_name,
    payload?.plan,
  ].filter((s): s is string => typeof s === "string" && s.length > 0);

  for (const raw of candidates) {
    const tier = normalizeTier(raw);
    if (tier) {
      return {
        tier,
        rawName: raw,
        source: "explicit",
        priceLabel: PLAN_PRICE_MAP[tier] ?? null,
      };
    }
  }

  // Step 2: 用 5h 窗口总配额反推
  if (primary) {
    // 取所有 model 的 max total，避免 general 占位 0 干扰判断
    let maxTotal = 0;
    const models = Array.isArray(payload?.model_remains) ? payload.model_remains : [];
    for (const m of models) {
      const t = m.current_interval_total_count ?? 0;
      if (t > maxTotal) maxTotal = t;
    }
    if (maxTotal <= 0) {
      const direct = primary.current_interval_total_count ?? 0;
      if (direct > 0) maxTotal = direct;
    }
    if (maxTotal > 0) {
      for (const entry of PLAN_TIER_BY_QUOTA) {
        if (maxTotal >= entry.minTotal) {
          return {
            tier: entry.tier,
            rawName: `≈ ${maxTotal} 次 / 5h`,
            source: "inferred",
            priceLabel: PLAN_PRICE_MAP[entry.tier] ?? null,
          };
        }
      }
    }
  }

  // Step 3: 拿不到
  return {
    tier: null,
    rawName: null,
    source: "unknown",
    priceLabel: null,
  };
}

function buildModelCard(model: ModelRemainRaw): ModelUsage {
  const total = model.current_interval_total_count ?? 0;
  const remaining = model.current_interval_usage_count ?? 0;
  const hasWindow =
    typeof model.start_time === "number" && typeof model.end_time === "number";

  // 权威来源：current_interval_remaining_percent（2026 API 新字段）
  const remainingPercent =
    typeof model.current_interval_remaining_percent === "number"
      ? model.current_interval_remaining_percent
      : null;

  // usedPercent 计算优先级：
  //   1. remainingPercent（最准确，MiniMax 官方给的）
  //   2. absolute count（total > 0 时）：used = total - remaining（注意 usage_count 是剩余，不是已用）
  //   3. 全空时回退到 null（让 UI 显示"-"而不是误判 0%）
  let usedPercent: number | null;
  let usedCount: number | null;
  if (remainingPercent != null) {
    usedPercent = Math.max(100 - remainingPercent, 0);
    usedCount = null; // 没 absolute 数据时 used 数值无意义，留 null
  } else if (total > 0) {
    const used = Math.max(total - remaining, 0);
    usedCount = used;
    usedPercent = Math.round((used / total) * 100);
  } else {
    usedCount = null;
    usedPercent = null;
  }

  // 周窗口 percent
  const weeklyRemainingPercent =
    typeof model.current_weekly_remaining_percent === "number"
      ? model.current_weekly_remaining_percent
      : null;
  const weeklyUsedPercent =
    weeklyRemainingPercent != null
      ? Math.max(100 - weeklyRemainingPercent, 0)
      : null;

  return {
    name: model.model_name ?? "Unknown Model",
    timeWindow: hasWindow
      ? `${formatTime(model.start_time!)} ~ ${formatTime(model.end_time!)}`
      : "",
    totalCount: total > 0 ? total : null,
    remainingCount: remaining > 0 ? remaining : null,
    usedCount,
    remainingPercent,
    usedPercent,
    weeklyRemainingPercent,
    weeklyUsedPercent,
  };
}

/**
 * 判断一个 model 是否"有可用数据"（保留进列表 / 可作 primary 候选）
 * 2026 改版后：很多 model 在 absolute count 上是 0/0，但 percent 字段才是权威
 */
function hasUsableData(model: ModelRemainRaw): boolean {
  if (typeof model.current_interval_remaining_percent === "number") return true;
  if ((model.current_interval_total_count ?? 0) > 0) return true;
  if ((model.current_interval_usage_count ?? 0) > 0) return true;
  if (typeof model.current_weekly_remaining_percent === "number") return true;
  if ((model.current_weekly_total_count ?? 0) > 0) return true;
  if ((model.current_weekly_usage_count ?? 0) > 0) return true;
  return false;
}

export function buildErrorViewModel(message: string, raw: unknown = null): UsageViewModel {
  return {
    ok: false,
    statusLabel: message,
    raw,
    primaryModelName: "",
    timeWindow: "",
    resetInLabel: "",
    resetTimestamp: null,
    totalCount: null,
    remainingCount: null,
    usedCount: null,
    remainingPercent: null,
    usedPercent: null,
    weeklyTotalCount: null,
    weeklyUsedCount: null,
    weeklyRemainingCount: null,
    weeklyRemainingPercent: null,
    weeklyUsedPercent: null,
    weeklyResetTimestamp: null,
    weeklyResetInLabel: "",
    plan: null,
    models: [],
  };
}

export function buildUsageViewModel(
  payload: MiniMaxRawPayload | null,
  ok: boolean,
  fallbackMessage: string,
  rawForError: unknown = null
): UsageViewModel {
  const models = Array.isArray(payload?.model_remains) ? payload.model_remains : [];
  const statusLabel = payload?.base_resp?.status_msg ?? fallbackMessage;

  // Primary 选取策略（2026 改版后）：
  //   1. 优先选有 remaining_percent 字段的 model —— 这是 MiniMax 的官方权威字段，
  //      通常出现在 "general" 这种套餐主 model 上
  //   2. 否则选第一个有可用数据（absolute count 非零 或 percent 有值）的 model
  //   3. 实在都没有，回退 models[0]（保证 UI 不崩）
  const primary =
    models.find(
      (m) => typeof m.current_interval_remaining_percent === "number"
    ) ??
    models.find(hasUsableData) ??
    models[0];

  if (!primary) {
    return ok
      ? { ...buildErrorViewModel(statusLabel, payload), ok: true }
      : buildErrorViewModel(statusLabel, rawForError ?? payload);
  }

  const card = buildModelCard(primary);

  const hasWindow =
    typeof primary.start_time === "number" && typeof primary.end_time === "number";

  const filtered = models.filter(hasUsableData).map(buildModelCard);

  // 周窗口数据：可能 primary 上没有（如 general），从其他 model 补
  // （简化：直接用 primary 的 weekly 字段；如果都没填，就显示空）
  const weeklyHasPercent = typeof primary.current_weekly_remaining_percent === "number";
  const weeklyHasCount =
    (primary.current_weekly_total_count ?? 0) > 0 ||
    (primary.current_weekly_usage_count ?? 0) > 0;
  const weeklyHasAny = weeklyHasPercent || weeklyHasCount;

  // 5h 窗口用的重置时间：兼容 remains_time（毫秒）+ end_time
  const primaryRemainsMs: number | null =
    typeof primary.remains_time === "number"
      ? primary.remains_time
      : typeof primary.end_time === "number"
      ? Math.max(primary.end_time - Date.now(), 0)
      : null;

  const weeklyRemainsMs: number | null =
    typeof primary.weekly_remains_time === "number"
      ? primary.weekly_remains_time
      : typeof primary.weekly_end_time === "number"
      ? Math.max(primary.weekly_end_time - Date.now(), 0)
      : null;

  return {
    ok,
    statusLabel,
    raw: payload,
    primaryModelName: primary.model_name ?? "",
    timeWindow: hasWindow
      ? `${formatDateTime(primary.start_time!)} ~ ${formatTime(primary.end_time!)} (UTC+8)`
      : "",
    resetInLabel:
      primaryRemainsMs != null ? formatResetIn(primaryRemainsMs) : "",
    resetTimestamp:
      primaryRemainsMs != null ? Date.now() + primaryRemainsMs : null,

    totalCount: card.totalCount,
    remainingCount: card.remainingCount,
    usedCount: card.usedCount,
    remainingPercent: card.remainingPercent,
    usedPercent: card.usedPercent,

    weeklyTotalCount: weeklyHasCount ? primary.current_weekly_total_count ?? 0 : null,
    weeklyUsedCount: weeklyHasCount
      ? Math.max((primary.current_weekly_total_count ?? 0) - (primary.current_weekly_usage_count ?? 0), 0)
      : null,
    weeklyRemainingCount: weeklyHasCount ? primary.current_weekly_usage_count ?? 0 : null,
    weeklyRemainingPercent: card.weeklyRemainingPercent,
    weeklyUsedPercent: card.weeklyUsedPercent,
    weeklyResetTimestamp: weeklyRemainsMs != null ? Date.now() + weeklyRemainsMs : null,
    weeklyResetInLabel:
      weeklyRemainsMs != null ? formatResetIn(weeklyRemainsMs) : "",

    plan: resolvePlanInfo(payload, primary),
    models: filtered,
  };
}

export async function fetchRemains(
  apiKey: string,
  signal?: AbortSignal
): Promise<UsageViewModel> {
  const validation = validateApiKey(apiKey);
  if (!validation.ok) {
    return buildErrorViewModel(validation.message);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  // 把外层 signal 合并进来
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener("abort", () => controller.abort(), { once: true });
  }

  try {
    const response = await fetch(REMAINS_ENDPOINT, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey.trim()}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
    });

    const payload = (await response.json()) as MiniMaxRawPayload;
    const statusCode = payload.status_code ?? payload.base_resp?.status_code ?? null;
    const statusMessage =
      payload.status_msg ?? payload.base_resp?.status_msg ?? null;

    if (statusCode === 0) {
      return buildUsageViewModel(payload, true, "查询成功");
    }
    if (statusCode === 1004) {
      return buildErrorViewModel("请检查 API Key 是否正确", payload);
    }
    return buildErrorViewModel(
      statusMessage ?? "MiniMax 返回了未识别的响应",
      payload
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "请求 MiniMax 失败";
    const friendly = message.toLowerCase().includes("abort")
      ? "请求超时，请重试"
      : message;
    return buildErrorViewModel(friendly);
  } finally {
    clearTimeout(timeoutId);
  }
}