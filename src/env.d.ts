/// <reference types="vite/client" />

declare module "*.vue" {
  import type { DefineComponent } from "vue";
  const component: DefineComponent<{}, {}, any>;
  export default component;
}

declare global {
  interface Window {
    electronAPI?: {
      platform: NodeJS.Platform;
      versions: NodeJS.ProcessVersions;

      openLogin: () => Promise<{ ok: boolean }>;
      cancelLogin: () => Promise<{ ok: boolean }>;
      logout: () => Promise<{ ok: boolean; message?: string }>;
      getAuthStatus: () => Promise<{
        ready: boolean;
        groupId: string | null;
        loggedInAt: number | null;
      }>;

      onLoginSuccess: (
        callback: (payload: {
          token: string;
          groupId: string;
          loggedInAt: number;
        }) => void
      ) => () => void;

      fetchDashboardSummary: (groupId: string) => Promise<unknown>;
      fetchDashboardRemains: (groupId: string) => Promise<unknown>;
      fetchDashboardCredit: (groupId: string) => Promise<unknown>;
    };
  }
}

export {};
