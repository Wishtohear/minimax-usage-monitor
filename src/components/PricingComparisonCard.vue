<script setup lang="ts">
import { computed } from "vue";
import { useUsageStore } from "@/stores/usage";
import {
  MODEL_PRICING,
  estimateCost,
  formatUSD,
  formatTokens,
  sumLastNDays,
  parseBigCount,
  DEFAULT_INPUT_RATIO,
} from "@/lib/pricing";

const store = useUsageStore();

interface Row {
  provider: string;
  model: string;
  totalCost: number;        // 累计
  last7Cost: number;
  last30Cost: number;
  note?: string;
}

// 三个时间维度的 token 数
const totalTokens = computed(() =>
  parseBigCount(store.dashboardSummary?.total_token_consumed)
);
const last7Tokens = computed(() =>
  sumLastNDays(store.dashboardSummary?.daily_token_usage, 7)
);
const last30Tokens = computed(() =>
  sumLastNDays(store.dashboardSummary?.daily_token_usage, 30)
);

const rows = computed<Row[]>(() => {
  return MODEL_PRICING.map((m) => ({
    provider: m.provider,
    model: m.model,
    totalCost: estimateCost(totalTokens.value, m, DEFAULT_INPUT_RATIO),
    last7Cost: estimateCost(last7Tokens.value, m, DEFAULT_INPUT_RATIO),
    last30Cost: estimateCost(last30Tokens.value, m, DEFAULT_INPUT_RATIO),
    note: m.note,
  }));
});

// 找出最便宜 / 最贵 的（提供对比感）
const sortedByTotal = computed(() =>
  [...rows.value].sort((a, b) => a.totalCost - b.totalCost)
);
const cheapestName = computed(
  () => sortedByTotal.value[0]?.model ?? "--"
);
const priciestName = computed(
  () => sortedByTotal.value[sortedByTotal.value.length - 1]?.model ?? "--"
);

// 总积余计算：如果都按最便宜的模型算 -> X 元
const mostExpensiveTotal = computed(() =>
  Math.max(...rows.value.map((r) => r.totalCost), 0)
);
const cheapestTotal = computed(() =>
  Math.min(...rows.value.map((r) => r.totalCost), Number.POSITIVE_INFINITY)
);
</script>

<template>
  <section class="card pricing-card" v-if="store.dashboardSummary">
    <div class="card-header">
      <span class="card-title">价格对照（理论花费估算）</span>
      <span class="card-subtitle">
        按输入 {{ Math.round(DEFAULT_INPUT_RATIO * 100) }}% / 输出 {{ Math.round((1 - DEFAULT_INPUT_RATIO) * 100) }}% 拆分
      </span>
    </div>

    <div class="pricing-summary">
      <div class="summary-block">
        <div class="summary-label">累计调用 token</div>
        <div class="summary-value">{{ formatTokens(totalTokens) }}</div>
      </div>
      <div class="summary-block">
        <div class="summary-label">近 7 天 token</div>
        <div class="summary-value">{{ formatTokens(last7Tokens) }}</div>
      </div>
      <div class="summary-block">
        <div class="summary-label">近 30 天 token</div>
        <div class="summary-value">{{ formatTokens(last30Tokens) }}</div>
      </div>
    </div>

    <div class="pricing-table-wrap">
      <table class="pricing-table">
        <thead>
          <tr>
            <th class="th-provider">厂商</th>
            <th class="th-model">模型</th>
            <th class="th-num">累计理论花费</th>
            <th class="th-num">近 7 天</th>
            <th class="th-num">近 30 天</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="r in sortedByTotal"
            :key="r.model"
            :class="{
              cheapest: r.model === cheapestName,
              priciest: r.model === priciestName,
            }"
          >
            <td class="td-provider">{{ r.provider }}</td>
            <td class="td-model">
              {{ r.model }}
              <span v-if="r.note" class="td-note">({{ r.note }})</span>
            </td>
            <td class="td-num highlight">{{ formatUSD(r.totalCost) }}</td>
            <td class="td-num">{{ formatUSD(r.last7Cost) }}</td>
            <td class="td-num">{{ formatUSD(r.last30Cost) }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="pricing-footnote">
      注：纯理论值（按公开列表价 * 估算 token 拆分）。MiniMax Token Plan 是月费订阅（¥49/119/469），不按 token 计费。
      <span v-if="mostExpensiveTotal > 0 && cheapestTotal < Number.POSITIVE_INFINITY">
        按"最贵模型"算需 {{ formatUSD(mostExpensiveTotal) }}，按"最便宜模型"算仅 {{ formatUSD(cheapestTotal) }}。
      </span>
    </div>
  </section>
</template>

<style scoped>
.pricing-card {
  display: grid;
  gap: 14px;
}

.pricing-summary {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.summary-block {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid #232733;
  border-radius: 10px;
  padding: 10px 14px;
}

.summary-label {
  font-size: 11px;
  color: #8b92a5;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.summary-value {
  margin-top: 4px;
  font-size: 18px;
  font-weight: 600;
  color: #e6e8ef;
  font-feature-settings: "tnum";
}

.pricing-table-wrap {
  overflow-x: auto;
  border: 1px solid #232733;
  border-radius: 10px;
}

.pricing-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  font-feature-settings: "tnum";
}

.pricing-table th,
.pricing-table td {
  padding: 10px 12px;
  text-align: left;
  border-bottom: 1px solid #232733;
}

.pricing-table th {
  background: rgba(255, 255, 255, 0.04);
  color: #8b92a5;
  font-weight: 500;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.pricing-table tr:last-child td {
  border-bottom: none;
}

.th-num,
.td-num {
  text-align: right;
  white-space: nowrap;
}

.td-provider {
  color: #c2cadb;
  font-weight: 500;
}

.td-model {
  color: #e6e8ef;
}

.td-note {
  color: #6c7384;
  font-size: 11px;
  margin-left: 4px;
}

.td-num.highlight {
  color: #f472b6;
  font-weight: 600;
}

.pricing-table tr.cheapest td.td-num.highlight {
  color: #4ade80;
}

.pricing-table tr.priciest td.td-num.highlight {
  color: #fbbf24;
}

.pricing-footnote {
  font-size: 11px;
  color: #6c7384;
  line-height: 1.5;
}
</style>