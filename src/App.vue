<script setup lang="ts">
import { onMounted, onBeforeUnmount, watch } from "vue";
import { useUsageStore } from "@/stores/usage";
import ApiKeyPanel from "@/components/ApiKeyPanel.vue";
import LoginPanel from "@/components/LoginPanel.vue";
import PrimaryUsageCard from "@/components/PrimaryUsageCard.vue";
import WeeklyQuotaCard from "@/components/WeeklyQuotaCard.vue";
import ModelListCard from "@/components/ModelListCard.vue";
import SubscriptionInfoCard from "@/components/SubscriptionInfoCard.vue";
import SubscriptionSummaryCard from "@/components/SubscriptionSummaryCard.vue";
import UsageTrendCard from "@/components/UsageTrendCard.vue";
import UsageHeatmapCard from "@/components/UsageHeatmapCard.vue";
import UsageOverviewCard from "@/components/UsageOverviewCard.vue";
import UsageDetailTable from "@/components/UsageDetailTable.vue";
import PricingComparisonCard from "@/components/PricingComparisonCard.vue";
import StatusBar from "@/components/StatusBar.vue";
import PlanBadge from "@/components/PlanBadge.vue";

const store = useUsageStore();

let pollTimer: number | null = null;

function startPolling() {
  if (pollTimer != null) return;
  // 立即拉一次
  if (store.hasApiKey) store.refresh();
  pollTimer = window.setInterval(() => {
    if (store.hasApiKey && !store.isLoading) {
      store.refresh();
    }
  }, store.intervalMinutes * 60_000);
}

function stopPolling() {
  if (pollTimer != null) {
    window.clearInterval(pollTimer);
    pollTimer = null;
  }
}

// 格式化原始 JSON：缺字段、超长时优雅降级
function formatRaw(raw: unknown): string {
  if (raw == null) return "(空)";
  try {
    const text = JSON.stringify(raw, null, 2);
    // 超过 20KB 就截断，避免撑爆布局
    if (text.length > 20_000) {
      return text.slice(0, 20_000) + "\n\n... (已截断，仅显示前 20KB)";
    }
    return text;
  } catch {
    return String(raw);
  }
}

onMounted(() => {
  startPolling();
});
onBeforeUnmount(stopPolling);

// 间隔变化时重启定时器（保持当前节奏同步）
watch(
  () => store.intervalMinutes,
  () => {
    stopPolling();
    startPolling();
  }
);
</script>

<template>
  <div class="app-shell">
    <header class="app-header">
      <div class="app-title">
        <span class="logo">M</span>
        <span>MiniMax 用量监控</span>
        <PlanBadge v-if="store.usage?.plan" />
      </div>
      <div class="header-actions">
        <button
          class="btn"
          :disabled="!store.hasApiKey || store.isLoading"
          @click="store.refresh()"
        >
          <span v-if="store.isLoading" class="spinner"></span>
          <span v-else>↻</span>
          <span>刷新</span>
        </button>
      </div>
    </header>

    <main class="app-main">
      <div class="app-content">
        <ApiKeyPanel />
        <LoginPanel />

        <PrimaryUsageCard />
        <WeeklyQuotaCard />
        <ModelListCard />

        <!-- Dashboard 真实调用量相关（登录后显示） -->
        <SubscriptionInfoCard v-if="store.hasDashboardSession" />
        <SubscriptionSummaryCard v-if="store.hasDashboardSession" />
        <UsageOverviewCard v-if="store.hasDashboardSession" />
        <UsageTrendCard v-if="store.hasDashboardSession" />
        <UsageHeatmapCard v-if="store.hasDashboardSession" />
        <UsageDetailTable v-if="store.hasDashboardSession" />
        <PricingComparisonCard v-if="store.hasDashboardSession" />

        <details v-if="store.usage" class="raw-json">
          <summary>查看 MiniMax 原始响应（用于核对字段）</summary>
          <pre>{{ formatRaw(store.usage.raw) }}</pre>
        </details>
      </div>
    </main>

    <StatusBar />
  </div>
</template>

<style scoped>
.raw-json {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid #232733;
  border-radius: 12px;
  padding: 10px 16px;
  font-size: 13px;
}

.raw-json summary {
  cursor: pointer;
  color: #8b92a5;
  user-select: none;
  padding: 4px 0;
  list-style: none;
}

.raw-json summary::-webkit-details-marker {
  display: none;
}

.raw-json summary::before {
  content: "▸ ";
  display: inline-block;
  transition: transform 0.15s ease;
}

.raw-json[open] > summary::before {
  content: "▾ ";
}

.raw-json summary:hover {
  color: #e6e8ef;
}

.raw-json pre {
  margin-top: 10px;
  max-height: 360px;
  overflow: auto;
  padding: 14px;
  background: #0a0c11;
  border: 1px solid #232733;
  border-radius: 8px;
  font-family: ui-monospace, "JetBrains Mono", Menlo, Consolas, monospace;
  font-size: 12px;
  line-height: 1.55;
  color: #c2cadb;
  white-space: pre;
  tab-size: 2;
}
</style>