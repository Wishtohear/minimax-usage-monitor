<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useUsageStore } from "@/stores/usage";
import type { OverviewPeriod } from "@/types/usage";

const store = useUsageStore();

const overview = computed(() => store.dashboardOverview);
const isLoading = computed(() => store.dashboardIsLoading);
const period = computed(() => store.overviewPeriod);

const PERIOD_TABS: { key: OverviewPeriod; label: string }[] = [
  { key: "day", label: "当日" },
  { key: "week", label: "近 7 天" },
  { key: "month", label: "近 30 天" },
];

// 图例配色：按模型名固定分配，跟官网保持同类色系
const PALETTE = [
  "#f472b6",
  "#a78bfa",
  "#22d3ee",
  "#facc15",
  "#4ade80",
  "#fb923c",
  "#60a5fa",
  "#f87171",
];

const modelOrder = ref<string[]>([]);
watch(
  () => overview.value?.trend,
  (trend) => {
    const seen = new Set<string>();
    for (const p of trend ?? []) {
      for (const m of p.models ?? []) {
        if (!seen.has(m.model)) seen.add(m.model);
      }
    }
    modelOrder.value = Array.from(seen);
  },
  { immediate: true }
);

function colorFor(model: string): string {
  const i = modelOrder.value.indexOf(model);
  return PALETTE[(i < 0 ? 0 : i) % PALETTE.length];
}

// 每个时间桶的堆叠分段（自下而上）
interface Segment {
  model: string;
  y: number;
  h: number;
  color: string;
}

const W = 680;
const H = 210;
const PAD_L = 52;
const PAD_R = 12;
const PAD_T = 14;
const PAD_B = 26;
const innerW = W - PAD_L - PAD_R;
const innerH = H - PAD_T - PAD_B;

const trend = computed(() => overview.value?.trend ?? []);
const maxTotal = computed(() => {
  const t = trend.value;
  if (t.length === 0) return 0;
  return Math.max(...t.map((p) => p.total_token ?? 0));
});

// 柱宽：桶少时留间隙，桶多时自动收窄
const step = computed(() => innerW / Math.max(trend.value.length, 1));
const barW = computed(() => Math.max(Math.min(step.value * 0.68, 26), 1.5));

const bars = computed<{ x: number; segments: Segment[]; label: string }[]>(() => {
  const max = maxTotal.value || 1;
  return trend.value.map((p, i) => {
    const models = [...(p.models ?? [])].sort((a, b) => b.token - a.token);
    const x = PAD_L + i * step.value + (step.value - barW.value) / 2;
    let acc = 0;
    const segments: Segment[] = [];
    for (const m of models) {
      if (m.token <= 0) continue;
      const h = (m.token / max) * innerH;
      const y = PAD_T + innerH - (acc / max) * innerH - h;
      segments.push({ model: m.model, y, h, color: colorFor(m.model) });
      acc += m.token;
    }
    return { x, segments, label: p.time_label };
  });
});

const yTicks = computed(() => {
  const max = maxTotal.value;
  if (max === 0) return [];
  return [0, 0.25, 0.5, 0.75, 1].map((p) => ({
    y: PAD_T + innerH - p * innerH,
    label: humanNumber(max * p),
  }));
});

// X 轴标签抽稀：最多显示 8 个，避免重叠
const xLabels = computed(() => {
  const t = trend.value;
  if (t.length === 0) return [];
  const maxLabels = 8;
  const every = Math.max(Math.ceil(t.length / maxLabels), 1);
  return t
    .map((p, i) => ({ x: PAD_L + i * step.value + step.value / 2, i }))
    .filter(({ i }) => i % every === 0 || i === t.length - 1)
    .map(({ x, i }) => ({ x, label: t[i].time_label }));
});

function humanNumber(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(0)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K`;
  return String(Math.round(n));
}

const cacheHitPercent = computed(() => {
  const raw = overview.value?.cache_hit_percent;
  if (raw == null) return null;
  const v = parseFloat(raw);
  return Number.isFinite(v) ? v : null;
});

const averageLabel = computed(() =>
  period.value === "day" ? "小时均值" : "日均值"
);
</script>

<template>
  <section
    class="card overview-card"
    v-if="store.hasDashboardSession && (overview || isLoading || store.dashboardError)"
  >
    <div class="card-header">
      <span class="card-title">用量总览</span>
      <div class="period-tabs">
        <button
          v-for="t in PERIOD_TABS"
          :key="t.key"
          class="period-tab"
          :class="{ active: period === t.key }"
          :disabled="isLoading"
          @click="store.setOverviewPeriod(t.key)"
        >
          {{ t.label }}
        </button>
      </div>
    </div>

    <div v-if="store.dashboardError" class="empty">
      <div class="empty-icon">⚠️</div>
      <div>{{ store.dashboardError }}</div>
    </div>

    <template v-else-if="overview">
      <!-- 指标行 -->
      <div class="metric-row">
        <div class="metric">
          <div class="metric-value">{{ humanNumber(overview.language_model_token) }}</div>
          <div class="metric-label">语言模型 Token</div>
        </div>
        <div class="metric">
          <div class="metric-value">
            {{ cacheHitPercent == null ? "--" : cacheHitPercent.toFixed(1) + "%" }}
          </div>
          <div class="metric-label">Cache 命中率</div>
          <div v-if="cacheHitPercent != null" class="hit-bar">
            <span class="hit-fill" :style="{ width: cacheHitPercent + '%' }"></span>
          </div>
        </div>
        <div class="metric">
          <div class="metric-value">{{ humanNumber(overview.trend_total_token) }}</div>
          <div class="metric-label">总量</div>
        </div>
        <div class="metric">
          <div class="metric-value">{{ humanNumber(overview.trend_average_token) }}</div>
          <div class="metric-label">{{ averageLabel }}</div>
        </div>
      </div>

      <!-- 堆叠柱状图 -->
      <div v-if="bars.length" class="chart-wrap">
        <svg
          :viewBox="`0 0 ${W} ${H}`"
          class="chart"
          preserveAspectRatio="none"
          role="img"
          aria-label="调用量趋势堆叠柱状图"
        >
          <g v-for="(t, i) in yTicks" :key="`y${i}`">
            <line :x1="PAD_L" :y1="t.y" :x2="W - PAD_R" :y2="t.y" class="grid-y" />
            <text :x="PAD_L - 6" :y="t.y + 3" class="axis-text">{{ t.label }}</text>
          </g>

          <g v-for="(b, i) in bars" :key="`b${i}`">
            <rect
              v-for="(s, j) in b.segments"
              :key="`s${j}`"
              :x="b.x"
              :y="s.y"
              :width="barW"
              :height="Math.max(s.h, 0.5)"
              :fill="s.color"
              rx="1"
            >
              <title>{{ b.label }} · {{ s.model }}：{{ humanNumber(s.h / innerH * maxTotal) }}</title>
            </rect>
          </g>

          <g v-for="(t, i) in xLabels" :key="`x${i}`">
            <text :x="t.x" :y="H - 8" class="axis-text axis-x">{{ t.label }}</text>
          </g>
        </svg>
      </div>

      <div v-else class="empty">
        <div class="empty-icon">📈</div>
        <div>暂无趋势数据</div>
      </div>

      <!-- 图例 -->
      <div v-if="modelOrder.length" class="legend">
        <span v-for="m in modelOrder" :key="m" class="legend-item">
          <span class="dot" :style="{ background: colorFor(m) }"></span>
          {{ m }}
        </span>
      </div>
      <div class="subtle">仅统计语言模型</div>
    </template>

    <div v-else-if="isLoading" class="empty">
      <div class="empty-icon">⏳</div>
      <div>加载中…</div>
    </div>
  </section>
</template>

<style scoped>
.overview-card {
  display: grid;
  gap: 14px;
}

.period-tabs {
  display: inline-flex;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid #232733;
  border-radius: 8px;
  padding: 2px;
  gap: 2px;
}

.period-tab {
  padding: 4px 12px;
  font-size: 12px;
  font-weight: 500;
  color: #8b92a5;
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}

.period-tab:hover:not(:disabled) {
  color: #e6e8ef;
}

.period-tab.active {
  background: rgba(80, 120, 255, 0.18);
  color: #e6e8ef;
}

.period-tab:disabled {
  opacity: 0.5;
  cursor: default;
}

.metric-row {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

@media (min-width: 900px) {
  .metric-row {
    grid-template-columns: repeat(4, 1fr);
  }
}

.metric {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid #232733;
  border-radius: 10px;
  padding: 12px 14px;
}

.metric-value {
  font-size: 20px;
  font-weight: 600;
  color: #e6e8ef;
  letter-spacing: -0.02em;
  font-feature-settings: "tnum";
}

.metric-label {
  margin-top: 4px;
  font-size: 12px;
  color: #8b92a5;
}

.hit-bar {
  margin-top: 8px;
  height: 4px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  overflow: hidden;
}

.hit-fill {
  display: block;
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, #22d3ee, #a78bfa);
}

.chart-wrap {
  background: rgba(0, 0, 0, 0.18);
  border-radius: 10px;
  padding: 8px;
}

.chart {
  width: 100%;
  height: 210px;
  display: block;
}

.grid-y {
  stroke: rgba(255, 255, 255, 0.06);
  stroke-width: 1;
}

.axis-text {
  font-family: ui-monospace, "JetBrains Mono", Menlo, Consolas, monospace;
  font-size: 10px;
  fill: #6c7384;
  text-anchor: end;
}

.axis-x {
  text-anchor: middle;
}

.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 14px;
}

.legend-item {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  color: #8b92a5;
}

.dot {
  width: 9px;
  height: 9px;
  border-radius: 2px;
  display: inline-block;
}

.subtle {
  font-size: 11px;
  color: #6c7384;
}

.empty {
  text-align: center;
  padding: 32px 0;
  color: #8b92a5;
}

.empty-icon {
  font-size: 28px;
  margin-bottom: 6px;
}
</style>
