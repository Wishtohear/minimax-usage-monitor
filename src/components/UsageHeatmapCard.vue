<script setup lang="ts">
import { computed } from "vue";
import { useUsageStore } from "@/stores/usage";

const store = useUsageStore();

interface DayCell {
  date: string;            // "2026-02-03"
  total: number;
  models: number;
  hasData: boolean;
}

// 把 date_model_usage 转成网格
const cells = computed<DayCell[]>(() => {
  const arr = store.dashboardSummary?.date_model_usage;
  if (!Array.isArray(arr)) return [];
  return arr.map((d) => ({
    date: d.date,
    total: d.total_token,
    models: d.models.length,
    hasData: d.total_token > 0 || d.models.length > 0,
  }));
});

const maxTotal = computed(() => {
  if (cells.value.length === 0) return 0;
  return Math.max(...cells.value.map((c) => c.total));
});

// log scale 颜色等级：让稀疏数据也能区分
function colorFor(total: number): string {
  if (total === 0) return "#1f2229";  // 完全无数据
  if (maxTotal.value === 0) return "#1f2229";
  // log
  const ratio = Math.log10(total + 1) / Math.log10(maxTotal.value + 1);
  // 5 个等级
  if (ratio < 0.2) return "#3a2a44";   // 浅紫
  if (ratio < 0.4) return "#6a3b66";   // 中紫
  if (ratio < 0.6) return "#a34579";   // 深紫
  if (ratio < 0.8) return "#d44a8a";   // 粉
  return "#f472b6";                     // 亮粉（最大）
}

// GitHub contribution 风格横排：
//   rows = 7（周一~周日）
//   cols = ceil((days + 首日 day-of-week 偏移) / 7) ≈ 数据天数对应的周数
// 每列 7 天，从上到下是 周一 → 周日
const CELL = 14;
const GAP = 3;
const ROW_H = CELL + GAP;       // 17
const COL_W = CELL + GAP;       // 17
const ROWS = 7;                  // 周一~周日固定 7 行
const PAD_TOP = 18;              // 顶部留月份标签位
const PAD_LEFT = 26;             // 左侧留 weekday 标签位（Mon..Sun）
const PAD_BOTTOM = 14;
const PAD_RIGHT = 14;

const startDow = computed(() => {
  if (cells.value.length === 0) return 0;
  const first = new Date(cells.value[0].date + "T00:00:00");
  // 周一=0、周二=1、... 周日=6
  return (first.getDay() + 6) % 7;
});

const totalDays = computed(() => cells.value.length);
const totalCols = computed(() => {
  if (cells.value.length === 0) return 0;
  return Math.ceil((cells.value.length + startDow.value) / ROWS);
});

const W = computed(() => PAD_LEFT + PAD_RIGHT + COL_W * Math.max(totalCols.value, 1));
const H = computed(() => PAD_TOP + PAD_BOTTOM + ROW_H * ROWS);

// 一个 cell 的 (x, y)：y = 周几，x = 周数
interface Positioned {
  date: string;
  total: number;
  models: number;
  x: number;
  y: number;
  color: string;
  hasData: boolean;
}
const positioned = computed<Positioned[]>(() => {
  return cells.value.map((c, i) => {
    const offset = startDow.value + i;
    const dow = offset % ROWS;          // 0=Mon..6=Sun
    const colIdx = Math.floor(offset / ROWS);
    return {
      ...c,
      x: PAD_LEFT + colIdx * COL_W,
      y: PAD_TOP + dow * ROW_H,
      color: colorFor(c.total),
    };
  });
});

// 左侧 weekday 标签（Mon..Sun）
const weekdayLabels = computed(() => {
  const names = ["一", "二", "三", "四", "五", "六", "日"];
  return names.map((label, i) => ({
    y: PAD_TOP + i * ROW_H + CELL / 2 + 3,
    label,
  }));
});

// 顶部月份标签：每隔 4 周显示一次
const monthLabels = computed(() => {
  if (cells.value.length === 0) return [];
  const out: { x: number; label: string }[] = [];
  // 用 cell 0 做起点，每过 4 周判断一次月份变化
  const monthNames = ["", "1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];
  let lastMonth = -1;
  for (let i = 0; i < totalDays.value; i += ROWS) {
    if (!cells.value[i]) break;
    const d = new Date(cells.value[i].date + "T00:00:00");
    const m = d.getMonth() + 1;
    if (m !== lastMonth) {
      out.push({
        x: PAD_LEFT + Math.floor((startDow.value + i) / ROWS) * COL_W,
        label: monthNames[m],
      });
      lastMonth = m;
    }
  }
  return out;
});

// 显示前几条最近的高亮日
const recentHot = computed(() => {
  return cells.value
    .filter((c) => c.hasData)
    .slice(-5)
    .reverse();
});

function humanNumber(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return String(n);
}
</script>

<template>
  <section class="card heatmap-card" v-if="store.dashboardSummary || store.dashboardIsLoading">
    <div class="card-header">
      <span class="card-title">调用热力图</span>
      <span class="card-subtitle">每天 token 调用量</span>
    </div>

    <div v-if="cells.length === 0" class="empty">
      <div class="empty-icon">📊</div>
      <div>暂无热力图数据</div>
    </div>

    <div v-else class="heatmap-scroll">
      <svg
        :viewBox="`0 0 ${W} ${H}`"
        :width="W"
        :height="H"
        class="heatmap-svg"
        role="img"
        aria-label="每日 token 调用量热力图"
      >
        <!-- 左侧 weekday 标签 -->
        <g v-for="(label, i) in weekdayLabels" :key="`wd${i}`">
          <text
            :x="22"
            :y="label.y"
            class="axis-text"
            text-anchor="end"
          >{{ label.label }}</text>
        </g>

        <!-- 顶部月份标签 -->
        <g v-for="(label, i) in monthLabels" :key="`mo${i}`">
          <text
            :x="label.x"
            :y="12"
            class="axis-text"
            text-anchor="start"
          >{{ label.label }}</text>
        </g>

        <!-- 主体格子 -->
        <g v-for="(c, i) in positioned" :key="i">
          <rect
            :x="c.x"
            :y="c.y"
            :width="CELL"
            :height="CELL"
            :fill="c.color"
            rx="2"
          >
            <title>{{ c.date }}：{{ humanNumber(c.total) }}（{{ c.models }} 个模型）</title>
          </rect>
        </g>
      </svg>

      <div class="heatmap-legend">
        <span class="legend-label">少</span>
        <div class="legend-strip">
          <span :style="{ background: '#1f2229' }"></span>
          <span :style="{ background: '#3a2a44' }"></span>
          <span :style="{ background: '#6a3b66' }"></span>
          <span :style="{ background: '#a34579' }"></span>
          <span :style="{ background: '#d44a8a' }"></span>
          <span :style="{ background: '#f472b6' }"></span>
        </div>
        <span class="legend-label">多</span>
      </div>

      <div v-if="recentHot.length" class="recent-hot">
        <span class="recent-title">最近活跃</span>
        <span v-for="d in recentHot" :key="d.date" class="recent-chip">
          {{ d.date.slice(5) }} · {{ humanNumber(d.total) }}
        </span>
      </div>
    </div>
  </section>
</template>

<style scoped>
.heatmap-card {
  display: grid;
  gap: 12px;
}

.heatmap-scroll {
  background: rgba(0, 0, 0, 0.18);
  border-radius: 10px;
  padding: 12px;
  display: flex;
  justify-content: center;
  overflow-x: auto;
}

.heatmap-svg {
  display: block;
  max-width: 100%;
  height: auto;
}

.axis-text {
  font-family: ui-monospace, "JetBrains Mono", Menlo, Consolas, monospace;
  font-size: 9px;
  fill: #6c7384;
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

.heatmap-legend {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  font-size: 11px;
  color: #6c7384;
}

.legend-strip {
  display: inline-flex;
  gap: 2px;
}

.legend-strip span {
  display: inline-block;
  width: 12px;
  height: 12px;
  border-radius: 2px;
}

.recent-hot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px dashed #232733;
}

.recent-title {
  font-size: 11px;
  color: #8b92a5;
  margin-right: 4px;
}

.recent-chip {
  padding: 2px 8px;
  background: rgba(244, 114, 182, 0.12);
  border: 1px solid rgba(244, 114, 182, 0.3);
  color: #f9a8d4;
  border-radius: 999px;
  font-size: 11px;
  font-family: ui-monospace, "JetBrains Mono", Menlo, Consolas, monospace;
}
</style>