<script setup lang="ts">
import { ref, computed } from "vue";
import { useUsageStore } from "@/stores/usage";

const store = useUsageStore();

type RangeDays = 7 | 30;
const rangeDays = ref<RangeDays>(30);

const dailyTokens = computed<number[]>(() => {
  const arr = store.dashboardSummary?.daily_token_usage;
  if (!Array.isArray(arr)) return [];
  // 数组最后是今天，所以取末尾 N 个
  return arr.slice(-rangeDays.value);
});

const maxValue = computed(() => {
  if (dailyTokens.value.length === 0) return 0;
  return Math.max(...dailyTokens.value);
});

// 格式化 Y 轴标签，token 数太大用 B/M/K
function humanNumber(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K`;
  return String(n);
}

// SVG 几何参数
const W = 680;
const H = 200;
const PAD_L = 50;
const PAD_R = 16;
const PAD_T = 16;
const PAD_B = 28;

const innerW = W - PAD_L - PAD_R;
const innerH = H - PAD_T - PAD_B;

const points = computed(() => {
  const data = dailyTokens.value;
  if (data.length === 0) return "";
  const max = Math.max(maxValue.value, 1);
  const stepX = data.length === 1 ? 0 : innerW / (data.length - 1);
  return data
    .map((v, i) => {
      const x = PAD_L + i * stepX;
      const y = PAD_T + innerH - (v / max) * innerH;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
});

const fillPath = computed(() => {
  if (!points.value) return "";
  // 折线 + 底部封闭面积
  const firstX = PAD_L;
  const lastX = W - PAD_R;
  return `M ${firstX},${PAD_T + innerH} L ${points.value.split(" ").join(" L ")} L ${lastX},${
    PAD_T + innerH
  } Z`;
});

// X 轴 ticks：起 / 中 / 末 三个
const xTicks = computed(() => {
  const data = dailyTokens.value;
  if (data.length === 0) return [];
  const idxs = [0, Math.floor((data.length - 1) / 2), data.length - 1].filter(
    (v, i, a) => a.indexOf(v) === i
  );
  return idxs.map((i) => ({
    x: PAD_L + (data.length === 1 ? 0 : (innerW * i) / (data.length - 1)),
    label: `第 ${data.length - i} 天前`,
  }));
});

// Y 轴 ticks：maxValue 的 0 / 0.5 / 1
const yTicks = computed(() => {
  const max = maxValue.value;
  if (max === 0) return [];
  return [0, 0.5, 1].map((p) => ({
    y: PAD_T + innerH - p * innerH,
    label: humanNumber(max * p),
  }));
});
</script>

<template>
  <section class="card trend-card" v-if="store.dashboardSummary || store.dashboardIsLoading">
    <div class="card-header">
      <span class="card-title">调用趋势</span>
      <div class="trend-tabs">
        <button
          class="trend-tab"
          :class="{ active: rangeDays === 7 }"
          @click="rangeDays = 7"
        >
          近 7 天
        </button>
        <button
          class="trend-tab"
          :class="{ active: rangeDays === 30 }"
          @click="rangeDays = 30"
        >
          近 30 天
        </button>
      </div>
    </div>

    <div v-if="dailyTokens.length === 0" class="empty">
      <div class="empty-icon">📈</div>
      <div>暂无{{ rangeDays }}天趋势数据</div>
    </div>

    <div v-else class="trend-svg-wrap">
      <svg
        :viewBox="`0 0 ${W} ${H}`"
        class="trend-svg"
        preserveAspectRatio="none"
        role="img"
        :aria-label="`最近 ${rangeDays} 天调用量趋势`"
      >
        <defs>
          <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#f472b6" stop-opacity="0.5" />
            <stop offset="100%" stop-color="#f472b6" stop-opacity="0" />
          </linearGradient>
        </defs>

        <!-- Y grid -->
        <g
          v-for="(t, i) in yTicks"
          :key="`y${i}`"
          class="grid-y"
        >
          <line :x1="PAD_L" :y1="t.y" :x2="W - PAD_R" :y2="t.y" />
          <text :x="PAD_L - 6" :y="t.y + 3" class="axis-text">{{ t.label }}</text>
        </g>

        <!-- 面积 -->
        <path :d="fillPath" fill="url(#trendGradient)" class="area" />

        <!-- 折线 -->
        <polyline :points="points" class="line" />

        <!-- X 轴 ticks -->
        <g v-for="(t, i) in xTicks" :key="`x${i}`" class="grid-x">
          <text :x="t.x" :y="H - 6" class="axis-text" text-anchor="middle">
            {{ t.label }}
          </text>
        </g>
      </svg>
    </div>
  </section>
</template>

<style scoped>
.trend-card {
  display: grid;
  gap: 12px;
}

.trend-tabs {
  display: inline-flex;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid #232733;
  border-radius: 8px;
  padding: 2px;
  gap: 2px;
}

.trend-tab {
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

.trend-tab:hover {
  color: #e6e8ef;
}

.trend-tab.active {
  background: rgba(80, 120, 255, 0.18);
  color: #e6e8ef;
}

.trend-svg-wrap {
  width: 100%;
  background: rgba(0, 0, 0, 0.18);
  border-radius: 10px;
  padding: 8px;
}

.trend-svg {
  width: 100%;
  height: 200px;
  display: block;
}

.grid-y line {
  stroke: rgba(255, 255, 255, 0.06);
  stroke-width: 1;
}

.axis-text {
  font-family: ui-monospace, "JetBrains Mono", Menlo, Consolas, monospace;
  font-size: 10px;
  fill: #6c7384;
  text-anchor: end;
}

.grid-x text {
  text-anchor: middle;
  fill: #6c7384;
}

.area {
  opacity: 0.6;
}

.line {
  fill: none;
  stroke: #f472b6;
  stroke-width: 2;
  stroke-linejoin: round;
  stroke-linecap: round;
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