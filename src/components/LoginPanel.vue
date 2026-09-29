<script setup lang="ts">
import { computed } from "vue";
import { useUsageStore } from "@/stores/usage";

const store = useUsageStore();

const session = computed(() => store.dashboardSession);

const isElectron = computed(() => typeof window !== "undefined" && !!window.electronAPI);

async function openLogin() {
  await store.openLogin();
}

async function logout() {
  await store.logout();
}
</script>

<template>
  <section class="card login-panel">
    <div class="login-header">
      <div class="login-title">
        <span class="login-icon">{{ session.ready ? "✓" : "🔐" }}</span>
        <span class="login-name">Dashboard 登录态</span>
      </div>
      <span v-if="session.ready" class="login-status ready">已登录</span>
      <span v-else class="login-status logged-out">未登录</span>
    </div>

    <div class="login-body">
      <template v-if="!isElectron">
        <div class="login-hint warn">
          未检测到 Electron runtime。请在 Electron 窗口里打开此页面（<code>npm start</code> 或
          <code>npm run dev</code>），不要直接用浏览器打开 <code>dist/index.html</code>。
        </div>
      </template>

      <template v-else-if="session.ready">
        <div class="login-meta">
          <div class="meta-row">
            <span class="meta-label">Group ID</span>
            <code class="meta-value mono">{{ session.groupId }}</code>
          </div>
          <div v-if="session.loggedInAt" class="meta-row">
            <span class="meta-label">登录时间</span>
            <span class="meta-value">{{ new Date(session.loggedInAt).toLocaleString("zh-CN") }}</span>
          </div>
        </div>
        <div class="login-actions">
          <button class="btn btn-secondary" @click="store.refreshDashboardData()">
            ↻ 刷新 dashboard 数据
          </button>
          <button class="btn btn-danger" @click="logout">登出</button>
        </div>
      </template>

      <template v-else>
        <p class="login-hint">
          登录后可以查看：累计调用量、单日峰值、活跃天数、调用趋势折线图、调用热力图、用量明细等"真实调用量"数据。
          登录窗口会内嵌在本应用内，关掉就退出登录。
        </p>
        <p class="login-hint warn">
          如果之前登录过 <code>minimaxi.com</code> 旧域名，升级后 cookie 不通用，
          需要在这里重新登录一次 <code>minimax.cn</code>。
        </p>
        <div class="login-actions">
          <button class="btn btn-primary" @click="openLogin">
            在应用内登录 MiniMax
          </button>
        </div>
      </template>

      <div v-if="store.dashboardError" class="login-hint error">
        {{ store.dashboardError }}
      </div>
    </div>
  </section>
</template>

<style scoped>
.login-panel {
  border-color: rgba(120, 130, 200, 0.25);
}

.login-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.login-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 15px;
  color: #e6e8ef;
}

.login-icon {
  font-size: 16px;
}

.login-status {
  padding: 2px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 500;
}

.login-status.ready {
  background: rgba(74, 222, 128, 0.15);
  color: #4ade80;
  border: 1px solid rgba(74, 222, 128, 0.3);
}

.login-status.logged-out {
  background: rgba(251, 191, 36, 0.1);
  color: #fbbf24;
  border: 1px solid rgba(251, 191, 36, 0.3);
}

.login-hint {
  margin: 8px 0 12px;
  color: #8b92a5;
  font-size: 13px;
  line-height: 1.55;
}

.login-hint.warn {
  color: #fbbf24;
  background: rgba(251, 191, 36, 0.08);
  border: 1px solid rgba(251, 191, 36, 0.25);
  border-radius: 8px;
  padding: 10px 12px;
}

.login-hint.error {
  color: #fca5a5;
  background: rgba(248, 113, 113, 0.08);
  border: 1px solid rgba(248, 113, 113, 0.25);
  border-radius: 8px;
  padding: 8px 12px;
  margin-top: 12px;
  font-size: 12px;
}

.login-meta {
  display: grid;
  gap: 6px;
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid #232733;
  border-radius: 8px;
  padding: 10px 12px;
  margin-bottom: 12px;
}

.meta-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  gap: 12px;
}

.meta-label {
  color: #8b92a5;
  flex-shrink: 0;
}

.meta-value {
  color: #e6e8ef;
  text-align: right;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mono {
  font-family: ui-monospace, "JetBrains Mono", Menlo, Consolas, monospace;
  font-size: 11px;
}

.login-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.btn {
  padding: 6px 14px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid transparent;
  transition: background 0.15s ease, border-color 0.15s ease;
}

.btn-primary {
  background: linear-gradient(135deg, #5865f2, #a855f7);
  color: white;
  border-color: rgba(255, 255, 255, 0.1);
}

.btn-primary:hover {
  filter: brightness(1.08);
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.04);
  color: #c2cadb;
  border-color: #2a2f3a;
}

.btn-secondary:hover {
  background: rgba(255, 255, 255, 0.08);
}

.btn-danger {
  background: rgba(248, 113, 113, 0.08);
  color: #fca5a5;
  border-color: rgba(248, 113, 113, 0.3);
}

.btn-danger:hover {
  background: rgba(248, 113, 113, 0.15);
}
</style>