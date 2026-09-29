<script setup lang="ts">
import { computed } from "vue";
import { useUsageStore } from "@/stores/usage";

const store = useUsageStore();
const summary = computed(() => store.dashboardSummary);
const isLoading = computed(() => store.dashboardIsLoading);

// 数字格式化（"17.70B" -> 数字 17.7 + "B"）
function parseCount(s: string | undefined): { value: number; unit: string } | null {
  if (!s) return null;
  const m = /^([\d.]+)([KMGTB]?)$/.exec(s.trim());
  if (!m) return null;
  return { value: parseFloat(m[1]), unit: m[2] || "" };
}

function fmtBig(s: string | undefined): string {
  const p = parseCount(s);
  if (!p) return s ?? "--";
  return `${p.value.toLocaleString("zh-CN", { maximumFractionDigits: 2 })}${p.unit}`;
}

// 把纯数字 token 数（如 1_970_000_000）格式化成 "1.97B" 风格
function fmtTokens(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "--";
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${(n / 1e9).toLocaleString("zh-CN", { maximumFractionDigits: 2 })}B`;
  if (abs >= 1e6) return `${(n / 1e6).toLocaleString("zh-CN", { maximumFractionDigits: 2 })}M`;
  if (abs >= 1e3) return `${(n / 1e3).toLocaleString("zh-CN", { maximumFractionDigits: 1 })}K`;
  return n.toLocaleString("zh-CN");
}

function sumLastN(arr: number[] | undefined, n: number): number | null {
  if (!arr || arr.length === 0) return null;
  const len = Math.min(n, arr.length);
  let s = 0;
  for (let i = arr.length - len; i < arr.length; i++) {
    s += arr[i] ?? 0;
  }
  return s;
}

const consecutiveDays = computed(() => summary.value?.current_consecutive_days ?? 0);

const last7 = computed<number | null>(() => sumLastN(summary.value?.daily_token_usage, 7));
const last30 = computed<number | null>(() => sumLastN(summary.value?.daily_token_usage, 30));
</script>

<template>
  <section class="card summary-card" v-if="summary || isLoading || store.dashboardError">
    <div class="card-header">
      <span class="card-title">累计用量（基于 dashboard）</span>
      <span v-if="isLoading" class="card-subtitle muted">加载中…</span>
      <span v-else-if="store.dashboardError" class="card-subtitle error">
        {{ store.dashboardError }}
      </span>
      <span v-else-if="summary" class="card-subtitle">
        共 {{ summary.total_days }} 天数据 · 百分位前 {{ summary.usage_ranking_percent }}%
      </span>
    </div>

    <div v-if="summary" class="summary-grid">
      <div class="metric">
        <div class="metric-value">{{ fmtBig(summary.total_token_consumed) }}</div>
        <div class="metric-label">累计调用量</div>
      </div>
      <div class="metric">
        <div class="metric-value">{{ fmtTokens(last7) }}</div>
        <div class="metric-label">近 7 天调用量</div>
      </div>
      <div class="metric">
        <div class="metric-value">{{ fmtTokens(last30) }}</div>
        <div class="metric-label">近 30 天调用量</div>
      </div>
      <div class="metric highlight">
        <div class="metric-value">
          {{ fmtBig(summary.most_active_day?.token_count) }}
        </div>
        <div class="metric-label">单日峰值{{ summary.most_active_day?.date ? `（${summary.most_active_day.date}）` : "" }}</div>
      </div>
      <div class="metric">
        <div class="metric-value">{{ summary.active_days }}</div>
        <div class="metric-label">活跃天数</div>
      </div>
      <div class="metric">
        <div class="metric-value">{{ consecutiveDays }}</div>
        <div class="metric-label">当前连续天数</div>
      </div>
    </div>

    <div v-else-if="!isLoading && store.dashboardError" class="empty">
      <div class="empty-icon">⚠️</div>
      <div>无法获取 dashboard 数据</div>
      <div class="hint" style="margin-top: 8px">
        请确认已登录，且网络可达 {{ store.dashboardSession.groupId ? '' : '需先登录' }}
      </div>
    </div>
  </section>
</template>

<style scoped>
.summary-card {
  display: grid;
  gap: 16px;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

@media (min-width: 720px) {
  .summary-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (min-width: 1100px) {
  .summary-grid {
    grid-template-columns: repeat(6, 1fr);
  }
}

.metric {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid #232733;
  border-radius: 10px;
  padding: 14px 16px;
}

.metric.highlight {
  border-color: rgba(244, 114, 182, 0.35);
  background: linear-gradient(135deg, rgba(244, 114, 182, 0.07), rgba(167, 139, 250, 0.05));
}

.metric-value {
  font-size: 22px;
  font-weight: 600;
  color: #e6e8ef;
  letter-spacing: -0.02em;
  font-feature-settings: "tnum";
}

.metric.highlight .metric-value {
  color: #f472b6;
}

.metric-label {
  margin-top: 6px;
  font-size: 12px;
  color: #8b92a5;
}

.muted {
  color: #8b92a5;
}
.error {
  color: #fca5a5;
}

.empty {
  text-align: center;
  padding: 24px 0;
  color: #8b92a5;
}

.empty-icon {
  font-size: 28px;
  margin-bottom: 6px;
}

.hint {
  font-size: 12px;
  color: #6c7384;
}
</style>