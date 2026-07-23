<script setup lang="ts">
import { computed } from "vue";
import { useUsageStore } from "@/stores/usage";
import type { ModelUsage } from "@/types/usage";

const store = useUsageStore();

const models = computed<ModelUsage[]>(() => store.usage?.models ?? []);

function progressClass(percent: number): string {
  if (percent >= 90) return "danger";
  if (percent >= 70) return "warn";
  return "";
}

// 优先用 usedPercent（新字段权威），没就用 absolute count 算
function barPercentOf(m: ModelUsage): number {
  if (m.usedPercent != null) return m.usedPercent;
  if (m.totalCount && m.usedCount != null) {
    return Math.round((m.usedCount / m.totalCount) * 100);
  }
  return 0;
}

// 右侧"百分比 + 剩余"标签
function pctLabelOf(m: ModelUsage): string {
  return `${barPercentOf(m)}%`;
}
function remainingLabelOf(m: ModelUsage): string {
  if (m.remainingPercent != null) return `剩 ${m.remainingPercent}%`;
  if (m.remainingCount != null) return `剩 ${m.remainingCount.toLocaleString("zh-CN")}`;
  return "";
}

function formatNumber(n: number | null | undefined): string {
  if (n == null) return "--";
  return n.toLocaleString("zh-CN");
}
</script>

<template>
  <section v-if="models.length" class="card">
    <div class="card-header">
      <span class="card-title">模型用量明细</span>
      <span class="card-subtitle">{{ models.length }} 个模型</span>
    </div>
    <div class="model-grid">
      <div v-for="m in models" :key="m.name" class="model-row">
        <div>
          <div class="model-row-name">{{ m.name }}</div>
          <div class="model-row-meta">
            <span>{{ m.timeWindow || "5h 窗口" }}</span>
            <template v-if="m.totalCount != null">
              · 总额度 {{ formatNumber(m.totalCount) }}
            </template>
            <template v-else-if="m.remainingPercent != null">
              · 套餐（按 % 计）
            </template>
          </div>
          <div class="progress" style="margin-top: 8px; height: 6px">
            <div
              class="progress-bar"
              :class="progressClass(barPercentOf(m))"
              :style="{ width: `${Math.min(Math.max(barPercentOf(m), 0), 100)}%` }"
            ></div>
          </div>
        </div>
        <div class="model-row-counters">
          <div class="pct">{{ pctLabelOf(m) }}</div>
          <div class="numbers">{{ remainingLabelOf(m) }}</div>
        </div>
      </div>
    </div>
  </section>
</template>