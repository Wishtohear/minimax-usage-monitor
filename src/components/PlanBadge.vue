<script setup lang="ts">
import { computed } from "vue";
import { useUsageStore } from "@/stores/usage";
import type { PlanInfo, PlanTier } from "@/types/usage";

const store = useUsageStore();
const plan = computed<PlanInfo | null>(() => store.usage?.plan ?? null);

const tierClass = computed<PlanTier | "unknown">(() => {
  const t = plan.value?.tier;
  return t ?? "unknown";
});

// 等级颜色：Plus 青、Max 紫、Ultra 粉
const tierColor = computed(() => {
  switch (tierClass.value) {
    case "Plus":
      return { fg: "#22d3ee", bg: "rgba(34, 211, 238, 0.12)" };
    case "Max":
      return { fg: "#a78bfa", bg: "rgba(167, 139, 250, 0.14)" };
    case "Ultra":
      return { fg: "#f472b6", bg: "rgba(244, 114, 182, 0.14)" };
    case "Starter":
      return { fg: "#94a3b8", bg: "rgba(148, 163, 184, 0.10)" };
    case "Free":
      return { fg: "#94a3b8", bg: "rgba(148, 163, 184, 0.10)" };
    case "Custom":
      return { fg: "#fbbf24", bg: "rgba(251, 191, 36, 0.12)" };
    default:
      return { fg: "#94a3b8", bg: "rgba(148, 163, 184, 0.08)" };
  }
});

const tierLabel = computed(() => {
  const t = plan.value?.tier;
  if (t) return t;
  if (plan.value?.source === "inferred" && plan.value.rawName) return "推断中…";
  return "未识别";
});
</script>

<template>
  <div
    v-if="plan"
    class="plan-badge"
    :class="`tier-${tierClass}`"
    :style="{ '--tier-fg': tierColor.fg, '--tier-bg': tierColor.bg }"
    :title="plan.source === 'explicit'
      ? `来自 API: ${plan.rawName}`
      : plan.source === 'inferred'
      ? `由 5h 窗口额度反推: ${plan.rawName}`
      : '未能识别套餐类型'"
  >
    <span class="plan-tier">{{ tierLabel }}</span>
    <span v-if="plan.priceLabel" class="plan-price">{{ plan.priceLabel }}</span>
    <span v-if="plan.source === 'inferred'" class="plan-source">≈</span>
  </div>
</template>

<style scoped>
.plan-badge {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 999px;
  background: var(--tier-bg);
  border: 1px solid var(--tier-fg);
  font-size: 13px;
  white-space: nowrap;
  user-select: none;
}

.plan-tier {
  font-weight: 600;
  color: var(--tier-fg);
}

.plan-price {
  color: var(--tier-fg);
  font-size: 11px;
  opacity: 0.85;
}

.plan-source {
  font-size: 10px;
  opacity: 0.6;
  color: var(--tier-fg);
}
</style>