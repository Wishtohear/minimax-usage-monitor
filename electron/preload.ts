import { contextBridge, ipcRenderer } from "electron";

export type LoginSuccessPayload = {
  token: string;
  groupId: string;
  loggedInAt: number;
};

const api = {
  platform: process.platform,
  versions: process.versions,

  // —— 鉴权流程 ——
  openLogin: () => ipcRenderer.invoke("auth:open-login"),
  cancelLogin: () => ipcRenderer.invoke("auth:cancel-login"),
  logout: () => ipcRenderer.invoke("auth:logout"),
  getAuthStatus: () =>
    ipcRenderer.invoke("auth:status") as Promise<{
      ready: boolean;
      groupId: string | null;
      loggedInAt: number | null;
    }>,

  onLoginSuccess: (callback: (payload: LoginSuccessPayload) => void) => {
    const handler = (_evt: unknown, payload: LoginSuccessPayload) => callback(payload);
    ipcRenderer.on("auth:login-success", handler);
    return () => ipcRenderer.off("auth:login-success", handler);
  },

  // —— Dashboard 数据 API ——
  fetchDashboardSummary: (groupId: string) =>
    ipcRenderer.invoke("dashboard:fetch-summary", groupId),
  fetchDashboardRemains: (groupId: string) =>
    ipcRenderer.invoke("dashboard:fetch-remains", groupId),
  fetchDashboardCredit: (groupId: string) =>
    ipcRenderer.invoke("dashboard:fetch-credit", groupId),
  // 用量总览 + 每日趋势，period: "day" | "week" | "month"
  fetchDashboardOverview: (groupId: string, period: string) =>
    ipcRenderer.invoke("dashboard:fetch-overview", groupId, period),
  // 用量明细，startTime / endTime 均为 YYYY-MM-DD（UTC+8）
  fetchDashboardHourlyDetail: (groupId: string, startTime: string, endTime: string) =>
    ipcRenderer.invoke("dashboard:fetch-hourly-detail", groupId, startTime, endTime),
};

contextBridge.exposeInMainWorld("electronAPI", api);

export type ElectronAPI = typeof api;