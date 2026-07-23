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
  const dashboardIsLoading = ref<boolean>(false);
  const dashboardError = ref<string | null>(null);

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
  }

  async function refreshDashboardAuthStatus(): Promise<void> {
    if (!window.electronAPI) return;
    try {
      const status = await window.electronAPI.getAuthStatus();
      dashboardSession.value = {
        ready: status.ready,
        groupId: status.groupId ?? loadDashboardGroupId(),
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
      const [summary, remains, credit] = await Promise.all([
        window.electronAPI.fetchDashboardSummary(groupId) as Promise<DashboardUsageSummary>,
        window.electronAPI.fetchDashboardRemains(groupId) as Promise<DashboardRemainsResponse>,
        window.electronAPI
          .fetchDashboardCredit(groupId)
          .catch(() => null) as Promise<TokenPlanCredit | null>,
      ]);
      dashboardSummary.value = summary;
      dashboardRemains.value = remains;
      dashboardCredit.value = credit;
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
    dashboardIsLoading,
    dashboardError,
    hasDashboardSession,
    refresh,
    setApiKey,
    setIntervalMinutes,
    openLogin,
    cancelLogin,
    logout,
    refreshDashboardAuthStatus,
    refreshDashboardData,
  };
});