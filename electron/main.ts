import { app, BrowserWindow, ipcMain, session, shell } from "electron";
import path from "node:path";

const isDev = process.env.NODE_ENV === "development";

// 用独立 session 持久化 dashboard 登录的 cookie，下次打开免登录
const DASH_AUTH_SESSION = "persist:minimax-auth";
const DASH_HOST = "www.minimax.cn";
const DASH_WEB_HOST = "platform.minimax.cn";
const DASH_GROUP_COOKIE = "minimax_group_id_v2";
const DASH_TOKEN_COOKIE = "_token";

let mainWindow: BrowserWindow | null = null;
let loginWindow: BrowserWindow | null = null;

// 从 auth session 里取 dashboard 的鉴权 cookie
// 严格限定 minimax.cn 域：持久化 session 里可能残留旧域名（minimaxi.com）的 cookie，
// 它对 minimax.cn 无效，不过滤会导致误判成"已登录"然后所有接口 401
async function readAuthCookies(): Promise<{
  token: string | null;
  groupId: string | null;
}> {
  const s = session.fromPartition(DASH_AUTH_SESSION);
  const cookies = await s.cookies.get({});
  // cookie 可能挂在 .minimax.cn 或 platform.minimax.cn 上，两者都算有效；
  // 旧域名 minimaxi.com 必须排除
  const owned = cookies.filter((c) => {
    const d = c.domain?.replace(/^\./, "") ?? "";
    return d === "minimax.cn" || d.endsWith(".minimax.cn");
  });
  const pick = (name: string) => owned.find((c) => c.name === name && c.value)?.value ?? null;
  return { token: pick(DASH_TOKEN_COOKIE), groupId: pick(DASH_GROUP_COOKIE) };
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1080,
    height: 760,
    minWidth: 800,
    minHeight: 600,
    title: "MiniMax 用量监控",
    backgroundColor: "#0d0f14",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools({ mode: "detach" });
  }

  return mainWindow;
}

function createLoginWindow() {
  // 如果登录窗口已开，聚焦它
  if (loginWindow && !loginWindow.isDestroyed()) {
    loginWindow.focus();
    return loginWindow;
  }

  loginWindow = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 980,
    minHeight: 640,
    title: "登录 MiniMax · MiniMax 用量监控",
    backgroundColor: "#0d0f14",
    autoHideMenuBar: true,
    parent: mainWindow ?? undefined,
    modal: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      partition: DASH_AUTH_SESSION,
    },
  });

  // 加载 dashboard 页面（未登录时会被重定向到登录）
  loginWindow.loadURL(`https://${DASH_WEB_HOST}/console/usage`);

  loginWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  // 轮询 cookie，一旦 _token + minimax_group_id_v2 都存在就视为登录成功
  // 通过 IPC 通知主窗口并关闭登录窗口
  const checkLogin = async () => {
    if (!loginWindow || loginWindow.isDestroyed()) return;
    try {
      const { token, groupId } = await readAuthCookies();
      if (token && groupId) {
        // 登录成功 —— 通知主窗口
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send("auth:login-success", {
            token,
            groupId,
            loggedInAt: Date.now(),
          });
        }
        // 关掉登录窗口
        if (!loginWindow.isDestroyed()) {
          loginWindow.close();
        }
        loginWindow = null;
        return;
      }
      setTimeout(checkLogin, 800);
    } catch (err) {
      setTimeout(checkLogin, 1200);
    }
  };

  // 等页面 ready 后开始轮询
  loginWindow.webContents.once("did-finish-load", () => {
    setTimeout(checkLogin, 600);
  });

  loginWindow.on("closed", () => {
    loginWindow = null;
  });

  return loginWindow;
}

// —— IPC handlers ——

// 打开 dashboard 登录窗口（自动等 cookie 出现）
ipcMain.handle("auth:open-login", () => {
  createLoginWindow();
  return { ok: true };
});

// 用户主动取消登录（关闭登录窗口）
ipcMain.handle("auth:cancel-login", () => {
  if (loginWindow && !loginWindow.isDestroyed()) {
    loginWindow.close();
  }
  loginWindow = null;
  return { ok: true };
});

// 主动登出（清掉持久 cookie，下次需要重新登录）
ipcMain.handle("auth:logout", async () => {
  try {
    const s = session.fromPartition(DASH_AUTH_SESSION);
    await s.clearStorageData();
    return { ok: true };
  } catch (err) {
    return { ok: false, message: String(err) };
  }
});

// 当前登录态（启动时由前端轮询，cookie 已存在就视为已登录）
ipcMain.handle("auth:status", async () => {
  try {
    const { token, groupId } = await readAuthCookies();
    return {
      ready: !!(token && groupId),
      groupId,
      loggedInAt: token ? Date.now() : null,
    };
  } catch {
    return { ready: false, groupId: null, loggedInAt: null };
  }
});

// 用 auth session 直接 fetch dashboard 后端 —— 自动带 cookie，无 CORS 限制
// 失败时统一返回 null，避免把 { error, ... } 之类的占位对象当成正常 payload 传到渲染层
async function dashFetch(apiPath: string, groupId: string): Promise<unknown | null> {
  const s = session.fromPartition(DASH_AUTH_SESSION);
  try {
    const response = await s.fetch(`https://${DASH_HOST}${apiPath}`, {
      method: "GET",
      headers: {
        "x-group-id": groupId,
        accept: "application/json, text/plain, */*",
        referer: `https://${DASH_WEB_HOST}/`,
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
          "(KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36",
      },
    });
    const text = await response.text();
    let payload: unknown;
    try {
      payload = JSON.parse(text);
    } catch {
      return null; // 登录页 HTML / 网关错误页
    }
    // 业务层错误（如 1004 not login）同样视为失败
    const code = (payload as { base_resp?: { status_code?: number } })?.base_resp
      ?.status_code;
    if (typeof code === "number" && code !== 0) return null;
    return payload;
  } catch {
    return null;
  }
}

ipcMain.handle("dashboard:fetch-summary", async (_evt, groupId: string) => {
  return await dashFetch("/backend/account/token_plan/usage_summary", groupId);
});

ipcMain.handle("dashboard:fetch-remains", async (_evt, groupId: string) => {
  return await dashFetch("/backend/account/token_plan/remains_percent", groupId);
});

ipcMain.handle("dashboard:fetch-credit", async (_evt, groupId: string) => {
  return await dashFetch("/backend/account/token_plan_credit", groupId);
});

// 用量总览 + 每日趋势（period: day | week | month）
ipcMain.handle(
  "dashboard:fetch-overview",
  async (_evt, groupId: string, period: string) => {
    const p = period === "week" || period === "month" ? period : "day";
    return await dashFetch(
      `/backend/account/token_plan/usage_overview?period=${p}`,
      groupId
    );
  }
);

// 用量明细（start_time / end_time 均为 YYYY-MM-DD，UTC+8）
ipcMain.handle(
  "dashboard:fetch-hourly-detail",
  async (_evt, groupId: string, startTime: string, endTime: string) => {
    const q = new URLSearchParams({ start_time: startTime, end_time: endTime });
    return await dashFetch(
      `/backend/account/token_plan/usage_hourly_detail?${q.toString()}`,
      groupId
    );
  }
);

app.whenReady().then(() => {
  createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});