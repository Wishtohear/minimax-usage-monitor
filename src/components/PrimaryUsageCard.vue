<script setup lang="ts">
import { computed } from "vue";
import { useUsageStore } from "@/stores/usage";
import { useCountdown } from "@/composables/useCountdown";

const store = useUsageStore();

const usage = computed(() => store.usage);

const usedPercent = computed(() => usage.value?.usedPercent ?? null);
const remainingPercent = computed(() => usage.value?.remainingPercent ?? null);

// 进度条按"已用%"显示（如果没有就当 0）
const barPercent = computed(() => usedPercent.value ?? 0);
const barClass = computed(() => {
  const p = barPercent.value;
  if (p >= 90) return "danger";
  if (p >= 70) return "warn";
  return "";
});

// 决定显示模式：
//   - "percent"：主套餐，只给了百分比（如 general），显示「剩余 X% / 已用 Y%」
//   - "count"：具体模型，给了 absolute count，显示「已用/剩余/总额度」数字
//   - "none"：都没数据
const displayMode = computed<"percent" | "count" | "none">(() => {
  const u = usage.value;
  if (!u) return "none";
  if (u.remainingPercent != null || u.usedPercent != null) return "percent";
  if (u.totalCount != null && u.totalCount > 0) return "count";
  return "none";
});

const resetTarget = computed<number | null>(() => usage.value?.resetTimestamp ?? null);
const { text: resetText } = useCountdown(resetTarget);

// 计费模式识别：从 dashboard credit 接口的 current_subscribe_title 字段判断
//   - 包含 "TokenPlan" / "Token Plan" → "Token Plan"
//   - 包含 "按量" / "PAYG" / "PayAsYouGo" → "按量付费"
//   - 都没命中或没登录 dashboard → "--"
type BillingMode = "tokenplan" | "payg" | "unknown";
const billingMode = computed<BillingMode>(() => {
  const title = store.dashboardCredit?.current_subscribe_title ?? "";
  if (!title) return "unknown";
  if (/token[_ ]?plan/i.test(title)) return "tokenplan";
  if (/pay[_ -]?as[_ -]?you[_ -]?go|按量付费|PAYG/i.test(title)) return "payg";
  // 兜底：包含月度/年度字样但没命中 tokenplan，按 tokenplan 处理
  if (/月度|年度|membership|会员/i.test(title)) return "tokenplan";
  return "unknown";
});
const billingModeLabel = computed(() => {
  switch (billingMode.value) {
    case "tokenplan":
      return "Token Plan";
    case "payg":
      return "按量付费";
    default:
      return "--";
  }
});

// 积分余额（来自 dashboard /token_plan_credit）
const creditRemaining = computed<number | null>(
  () => store.dashboardCredit?.remaining_credits ?? null
);
const creditTotal = computed<number | null>(
  () => store.dashboardCredit?.total_credits ?? null
);
function fmtCredit(n: number | null | undefined): string {
  if (n == null) return "--";
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toLocaleString("zh-CN");
}

function formatNumber(n: number | null | undefined): string {
  if (n == null) return "--";
  return n.toLocaleString("zh-CN");
}
</script>

<template>
  <section class="card primary-card">
    <template v-if="usage && usage.ok">
      <div class="primary-top">
        <div>
          <div class="primary-model">
            {{ usage.primaryModelName || "MiniMax Token Plan" }}
          </div>
          <div class="primary-meta">
            <span>{{ usage.timeWindow || "5 小时窗口" }}</span>
            <span v-if="usage.timeWindow"> · </span>
            <span>下次重置：{{ resetText }}</span>
          </div>
        </div>
        <div class="primary-percent">{{ formatNumber(usedPercent) }}%</div>
      </div>

      <div class="progress">
        <div
          class="progress-bar"
          :class="barClass"
          :style="{ width: `${Math.min(Math.max(barPercent, 0), 100)}%` }"
        ></div>
      </div>

      <div class="primary-counts">
        <!-- Percent 模式：显示剩余 / 已用 / 计费模式 -->
        <template v-if="displayMode === 'percent'">
          <div class="count-block">
            <div class="label">剩余</div>
            <div class="value">{{ formatNumber(remainingPercent) }}%</div>
          </div>
          <div class="count-block">
            <div class="label">已用</div>
            <div class="value">{{ formatNumber(usedPercent) }}%</div>
          </div>
          <div class="count-block">
            <div class="label">计费模式</div>
            <div class="value">{{ billingModeLabel }}</div>
          </div>
        </template>

        <!-- Count 模式：显示已用 / 剩余 / 总额度 -->
        <template v-else-if="displayMode === 'count'">
          <div class="count-block">
            <div class="label">已使用</div>
            <div class="value">{{ formatNumber(usage.usedCount) }}</div>
          </div>
          <div class="count-block">
            <div class="label">剩余</div>
            <div class="value">{{ formatNumber(usage.remainingCount) }}</div>
          </div>
          <div class="count-block">
            <div class="label">总额度</div>
            <div class="value">{{ formatNumber(usage.totalCount) }}</div>
          </div>
        </template>

        <!-- 没数据时不显示底部 -->
        <template v-else></template>
      </div>

      <!-- 积分余额（从 dashboard credit 接口，登录后才有值） -->
      <div class="credit-strip" v-if="usage.ok">
        <div class="credit-strip-item">
          <span class="credit-strip-label">计费</span>
          <span class="credit-strip-value">
            <span :class="['mode-pill', `mode-${billingMode}`]">
              {{ billingModeLabel }}
            </span>
          </span>
        </div>
        <div class="credit-strip-divider"></div>
        <div class="credit-strip-item">
          <span class="credit-strip-label">积分余额</span>
          <span
            class="credit-strip-value"
            :class="creditRemaining != null && creditRemaining > 0 ? 'highlight' : ''"
          >
            {{ fmtCredit(creditRemaining) }}
          </span>
          <span v-if="creditTotal != null" class="credit-strip-sub">
            / {{ fmtCredit(creditTotal) }}
          </span>
        </div>
        <div v-if="!store.hasDashboardSession" class="credit-strip-hint">
          <span>↑</span>
          <span>在「Dashboard 登录」面板点「在应用内登录 MiniMax」后填充</span>
        </div>
      </div>
    </template>

    <template v-else-if="usage && !usage.ok">
      <div class="empty">
        <div class="empty-icon">⚠️</div>
        <div>{{ usage.statusLabel }}</div>
        <div class="hint" style="margin-top: 8px">
          请检查 API Key 是否为「订阅 Key」（Token Plan 专用），
          以及套餐是否已生效。
        </div>
      </div>
    </template>

    <template v-else>
      <div class="empty">
        <div class="empty-icon">⏳</div>
        <div>等待首次查询…</div>
        <div class="hint" style="margin-top: 8px">
          请先填入 API Key 并点击保存。
        </div>
      </div>
    </template>
  </section>
</template>

<style scoped>
.credit-strip {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 10px 14px;
  margin-top: 12px;
  background: rgba(0, 0, 0, 0.18);
  border: 1px solid #232733;
  border-radius: 10px;
  font-size: 13px;
}

.credit-strip-item {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.credit-strip-divider {
  width: 1px;
  height: 18px;
  background: #2a2f3a;
}

.credit-strip-label {
  color: #8b92a5;
  font-size: 12px;
}

.credit-strip-value {
  color: #e6e8ef;
  font-weight: 500;
  font-feature-settings: "tnum";
}

.credit-strip-value.highlight {
  color: #4ade80;
  font-weight: 600;
  font-size: 15px;
}

.credit-strip-sub {
  color: #6c7384;
  font-size: 12px;
  font-feature-settings: "tnum";
}

.mode-pill {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.02em;
  border: 1px solid;
}

.mode-pill.mode-tokenplan {
  background: rgba(167, 139, 250, 0.12);
  border-color: rgba(167, 139, 250, 0.45);
  color: #c4b5fd;
}

.mode-pill.mode-payg {
  background: rgba(34, 211, 238, 0.12);
  border-color: rgba(34, 211, 238, 0.45);
  color: #67e8f9;
}

.mode-pill.mode-unknown {
  background: rgba(148, 163, 184, 0.08);
  border-color: rgba(148, 163, 184, 0.3);
  color: #94a3b8;
}

.credit-strip-hint {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: auto;
  font-size: 11px;
  color: #8b92a5;
  font-style: italic;
}

.credit-strip-hint span:first-child {
  color: #a78bfa;
  font-size: 13px;
  font-style: normal;
}
</style>