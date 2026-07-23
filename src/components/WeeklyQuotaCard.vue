<script setup lang="ts">
import { computed } from "vue";
import { useUsageStore } from "@/stores/usage";
import { useCountdown } from "@/composables/useCountdown";

const store = useUsageStore();

const usage = computed(() => store.usage);

// 2026 改版：weekly 也可能只有 percent，没有 count
const visible = computed(() => {
  const u = usage.value;
  if (!u) return false;
  if (u.weeklyRemainingPercent != null || u.weeklyUsedPercent != null) return true;
  if (u.weeklyTotalCount != null && u.weeklyTotalCount > 0) return true;
  return false;
});

// 进度按"已用%"画
const barPercent = computed(() => usage.value?.weeklyUsedPercent ?? 0);
const barClass = computed(() => {
  const p = barPercent.value;
  if (p >= 90) return "danger";
  if (p >= 70) return "warn";
  return "";
});

// 如果周配额已用 0% 且剩余 100%，认为不限额
const isUnlimited = computed(() => {
  const u = usage.value;
  if (!u) return false;
  return u.weeklyUsedPercent === 0 && u.weeklyRemainingPercent === 100;
});

const displayMode = computed<"percent" | "count">(() => {
  const u = usage.value;
  if (!u) return "percent";
  if (u.weeklyTotalCount != null && u.weeklyTotalCount > 0) return "count";
  return "percent";
});

const resetTarget = computed<number | null>(() => usage.value?.weeklyResetTimestamp ?? null);
const { text: resetText } = useCountdown(resetTarget);

function formatNumber(n: number | null | undefined): string {
  if (n == null) return "--";
  return n.toLocaleString("zh-CN");
}
</script>

<style scoped>
.unlimited-pill {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 500;
  background: rgba(74, 222, 128, 0.12);
  border: 1px solid rgba(74, 222, 128, 0.4);
  color: #4ade80;
}
</style>

<template>
  <section v-if="visible" class="card">
    <div class="card-header">
      <span class="card-title">本周配额（Weekly）</span>
      <span class="card-subtitle">重置：{{ resetText }}</span>
    </div>
    <div class="primary-top">
      <div>
        <div class="primary-meta">
          <template v-if="isUnlimited">
            <span class="unlimited-pill">不限额</span>
            <span style="margin-left: 8px; color: #8b92a5">
              本周配额已开启（剩余 100%）
            </span>
          </template>
          <template v-else-if="displayMode === 'count'">
            本周已使用 {{ formatNumber(usage?.weeklyUsedCount) }} /
            {{ formatNumber(usage?.weeklyTotalCount) }}
          </template>
          <template v-else>
            本周剩余 {{ formatNumber(usage?.weeklyRemainingPercent) }}%
            · 已用 {{ formatNumber(usage?.weeklyUsedPercent) }}%
          </template>
        </div>
      </div>
      <div v-if="!isUnlimited" class="primary-percent">
        {{ formatNumber(usage?.weeklyUsedPercent) }}%
      </div>
    </div>
    <div v-if="!isUnlimited" class="progress">
      <div
        class="progress-bar"
        :class="barClass"
        :style="{ width: `${Math.min(Math.max(barPercent, 0), 100)}%` }"
      ></div>
    </div>
    <div class="progress">
      <div
        class="progress-bar"
        :class="barClass"
        :style="{ width: `${Math.min(Math.max(barPercent, 0), 100)}%` }"
      ></div>
    </div>
  </section>
</template>