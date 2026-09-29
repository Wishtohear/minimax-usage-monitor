import { defineStore } from "pinia";
import { ref, computed, watch } from "vue";
import { fetchRemains, validateApiKey } from "@/lib/minimax";
import type {
  UsageViewModel,
  RefreshIntervalMinutes,
  DashboardSession,
  DashboardUsageSummary,
  DashboardRemainsResponse,
  TokenPlanCredit,
  DashboardUsageOverview,
  DashboardHourlyDetail,
  OverviewPeriod,
} from "@/types/usage";

const STORAGE_KEY_API_KEY = "minimax.usage.apiKey";
const STORAGE_KEY_INTERVAL = "minimax.usage.intervalMinutes";
const STORAGE_KEY_DASHBOARD_GROUP = "minimax.usage.dashboardGroupId";

function loadApiKey(): string {
  try {
    return localStorage.getItem(STORAGE_KEY_API_KEY) ?? "";
  } catch {
    return "";
  }
}

function loadInterval(): RefreshIntervalMinutes {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_INTERVAL);
    const n = raw ? Number(raw) : 5;
    return ([1, 5, 15, 30] as RefreshIntervalMinutes[]).includes(n as RefreshIntervalMinutes)
      ? (n as RefreshIntervalMinutes)
      : 5;
  } catch {
    return 5;
  }
}

function loadDashboardGroupId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY_DASHBOARD_GROUP);
  } catch {
    return null;
  }
}

// 主进程对失败的请求返回 null；这里再按各接口的关键字段做一次形状校验，
// 避免结构不符的 payload 被当成正常数据渲染
function hasFields<T>(v: unknown, keys: (keyof T)[]): v is T {
  if (v == null || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return keys.some((k) => o[k as string] !== undefined);
}

const isSummaryPayload = (v: unknown) =>
  hasFields<DashboardUsageSummary>(v, ["most_active_day", "total_days", "daily_token_usage"]);

const isRemainsPayload = (v: unknown) =>
  hasFields<DashboardRemainsResponse>(v, ["model_remains"]);

const isCreditPayload = (v: unknown) =>
  hasFields<TokenPlanCredit>(v, ["total_credits", "remaining_credits"]);

const isOverviewPayload = (v: unknown) =>
  hasFields<DashboardUsageOverview>(v, ["trend", "language_model_token"]);

const isHourlyDetailPayload = (v: unknown) =>
  hasFields<DashboardHourlyDetail>(v, ["entries"]);

export const useUsageStore = defineStore("usage", () => {
  const apiKey = ref<string>(loadApiKey());
  const intervalMinutes = ref<RefreshIntervalMinutes>(loadInterval());
  const usage = ref<UsageViewModel | null>(null);
  const isLoading = ref<boolean>(false);
  const lastUpdatedAt = ref<number | null>(null);
  const lastError = ref<string | null>(null);

  const hasApiKey = computed(() => validateApiKey(apiKey.value).ok);
  const nextRefreshAt = ref<number | null>(null);

  // —— Dashboard 登录态 ——
  const dashboardSession = ref<DashboardSession>({
    ready: false,
    groupId: loadDashboardGroupId(),
    loggedInAt: null,
    accountLabel: null,
  });
  const dashboardSummary = ref<DashboardUsageSummary | null>(null);
  const dashboardRemains = ref<DashboardRemainsResponse | null>(null);
  const dashboardCredit = ref<TokenPlanCredit | null>(null);
  const dashboardOverview = ref<DashboardUsageOverview | null>(null);
  const dashboardHourlyDetail = ref<DashboardHourlyDetail | null>(null);
  const dashboardIsLoading = ref<boolean>(false);
  const dashboardError = ref<string | null>(null);

  // 用量总览的时间维度（对应页面的"当日 / 近 7 天 / 近 30 天"）
  const overviewPeriod = ref<OverviewPeriod>("day");

  const hasDashboardSession = computed(() => dashboardSession.value.ready);

  watch(apiKey, (v) => {
    try {
      localStorage.setItem(STORAGE_KEY_API_KEY, v);
    } catch {}
  });

  watch(intervalMinutes, (v) => {
    try {
      localStorage.setItem(STORAGE_KEY_INTERVAL, String(v));
    } catch {}
  });

  watch(
    () => dashboardSession.value.groupId,
    (v) => {
      try {
        if (v) localStorage.setItem(STORAGE_KEY_DASHBOARD_GROUP, v);
        else localStorage.removeItem(STORAGE_KEY_DASHBOARD_GROUP);
      } catch {}
    }
  );

  // —— 操作 ——
  async function refresh(): Promise<void> {
    if (!hasApiKey.value) {
      lastError.value = "请先填写 API Key";
      return;
    }
    isLoading.value = true;
    try {
      const result = await fetchRemains(apiKey.value);
      usage.value = result;
      lastUpdatedAt.value = Date.now();
      nextRefreshAt.value = Date.now() + intervalMinutes.value * 60_000;
      lastError.value = result.ok ? null : result.statusLabel;
    } finally {
      isLoading.value = false;
    }
  }

  async function openLogin(): Promise<void> {
    if (!window.electronAPI) {
      dashboardError.value = "Electron API 未注入，可能在浏览器中直接打开了 dist/index.html";
      return;
    }
    await window.electronAPI.openLogin();
  }

  async function cancelLogin(): Promise<void> {
    if (window.electronAPI) await window.electronAPI.cancelLogin();
  }

  async function logout(): Promise<void> {
    if (!window.electronAPI) return;
    dashboardError.value = null;
    await window.electronAPI.logout();
    dashboardSession.value = {
      ready: false,
      groupId: null,
      loggedInAt: null,
      accountLabel: null,
    };
    dashboardSummary.value = null;
    dashboardRemains.value = null;
    dashboardCredit.value = null;
    dashboardOverview.value = null;
    dashboardHourlyDetail.value = null;
  }

  async function refreshDashboardAuthStatus(): Promise<void> {
    if (!window.electronAPI) return;
    try {
      const status = await window.electronAPI.getAuthStatus();
      dashboardSession.value = {
        ready: status.ready,
        // 未登录时不要沿用 localStorage 里的历史 groupId，
        // 否则会拿着失效的 id 去请求，所有卡片都是空
        groupId: status.ready ? (status.groupId ?? loadDashboardGroupId()) : null,
        loggedInAt: status.loggedInAt ?? null,
        accountLabel: dashboardSession.value.accountLabel,
      };
      // 拉过一次确认登录后，自动刷一次数据
      if (status.ready && status.groupId) {
        refreshDashboardData();
      }
    } catch (err) {
      dashboardError.value = err instanceof Error ? err.message : String(err);
    }
  }

  async function refreshDashboardData(): Promise<void> {
    if (!window.electronAPI) return;
    const groupId = dashboardSession.value.groupId;
    if (!groupId) return;
    dashboardIsLoading.value = true;
    try {
      // 全部按 unknown 接收，由 is*Payload 守卫做真正的类型收窄
      const [summary, remains, credit, overview] = await Promise.all([
        window.electronAPI.fetchDashboardSummary(groupId).catch(() => null),
        window.electronAPI.fetchDashboardRemains(groupId).catch(() => null),
        window.electronAPI.fetchDashboardCredit(groupId).catch(() => null),
        window.electronAPI
          .fetchDashboardOverview(groupId, overviewPeriod.value)
          .catch(() => null),
      ]);
      dashboardSummary.value = isSummaryPayload(summary) ? summary : null;
      dashboardRemains.value = isRemainsPayload(remains) ? remains : null;
      dashboardCredit.value = isCreditPayload(credit) ? credit : null;
      dashboardOverview.value = isOverviewPayload(overview) ? overview : null;

      // 全部失败时给出可操作的提示，而不是让所有卡片静默显示 "--"
      if (
        !dashboardSummary.value &&
        !dashboardRemains.value &&
        !dashboardCredit.value &&
        !dashboardOverview.value
      ) {
        dashboardError.value =
          "MiniMax 接口全部无数据，通常是登录态已过期，请点「登出」后重新登录";
      } else {
        dashboardError.value = null;
      }
    } catch (err) {
      dashboardError.value = err instanceof Error ? err.message : String(err);
    } finally {
      dashboardIsLoading.value = false;
    }
  }

  async function setOverviewPeriod(p: OverviewPeriod): Promise<void> {
    overviewPeriod.value = p;
    const groupId = dashboardSession.value.groupId;
    if (!window.electronAPI || !groupId) return;
    dashboardIsLoading.value = true;
    try {
      const res = await window.electronAPI.fetchDashboardOverview(groupId, p);
      dashboardOverview.value = isOverviewPayload(res) ? res : null;
      dashboardError.value = null;
    } catch (err) {
      dashboardError.value = err instanceof Error ? err.message : String(err);
    } finally {
      dashboardIsLoading.value = false;
    }
  }

  // 用量明细：默认拉今天（UTC+8）
  function todayUtc8(): string {
    return new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10);
  }

  async function loadHourlyDetail(startTime: string, endTime: string): Promise<void> {
    if (!window.electronAPI) return;
    const groupId = dashboardSession.value.groupId;
    if (!groupId) return;
    dashboardIsLoading.value = true;
    try {
      const res = await window.electronAPI.fetchDashboardHourlyDetail(
        groupId,
        startTime,
        endTime
      );
      dashboardHourlyDetail.value = isHourlyDetailPayload(res) ? res : null;
      dashboardError.value = null;
    } catch (err) {
      dashboardError.value = err instanceof Error ? err.message : String(err);
    } finally {
      dashboardIsLoading.value = false;
    }
  }

  function handleLoginSuccess(payload: { token: string; groupId: string; loggedInAt: number }) {
    dashboardSession.value = {
      ready: true,
      groupId: payload.groupId,
      loggedInAt: payload.loggedInAt,
      accountLabel: payload.groupId, // 用 group_id 当账号标识；后续可在解码 JWT 时换
    };
    refreshDashboardData();
  }

  // 监听主进程推送的登录成功事件
  if (typeof window !== "undefined" && window.electronAPI?.onLoginSuccess) {
    window.electronAPI.onLoginSuccess(handleLoginSuccess);
  }

  // 启动时尝试恢复已登录态
  if (typeof window !== "undefined" && window.electronAPI) {
    refreshDashboardAuthStatus();
  }

  function setApiKey(key: string) {
    apiKey.value = key.trim();
  }
  function setIntervalMinutes(v: RefreshIntervalMinutes) {
    intervalMinutes.value = v;
  }

  return {
    apiKey,
    intervalMinutes,
    usage,
    isLoading,
    lastUpdatedAt,
    lastError,
    hasApiKey,
    nextRefreshAt,
    dashboardSession,
    dashboardSummary,
    dashboardRemains,
    dashboardCredit,
    dashboardOverview,
    dashboardHourlyDetail,
    dashboardIsLoading,
    dashboardError,
    overviewPeriod,
    hasDashboardSession,
    refresh,
    setApiKey,
    setIntervalMinutes,
    openLogin,
    cancelLogin,
    logout,
    refreshDashboardAuthStatus,
    refreshDashboardData,
    setOverviewPeriod,
    loadHourlyDetail,
    todayUtc8,
  };
});