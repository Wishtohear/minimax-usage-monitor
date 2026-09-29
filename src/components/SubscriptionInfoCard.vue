<script setup lang="ts">
import { computed } from "vue";
import { useUsageStore } from "@/stores/usage";

const store = useUsageStore();

interface PlanMeta {
  tier: string;
  priceCNY: number | null;
  priceLabel: string | null;
  color: string;
}

// 套餐对照（与 PlanBadge 保持一致；这里加强版本号、有效期等）
const PLAN_META: Record<string, PlanMeta> = {
  Plus: {
    tier: "Plus",
    priceCNY: 49,
    priceLabel: "¥49 / 月",
    color: "#22d3ee",
  },
  Max: {
    tier: "Max",
    priceCNY: 119,
    priceLabel: "¥119 / 月",
    color: "#a78bfa",
  },
  Ultra: {
    tier: "Ultra",
    priceCNY: 469,
    priceLabel: "¥469 / 月",
    color: "#f472b6",
  },
  Starter: {
    tier: "Starter",
    priceCNY: null,
    priceLabel: "已停售",
    color: "#94a3b8",
  },
};

// 当前套餐优先用 dashboard 后端（fetchCredit 也带上 current_subscribe_title）
const dashboardTitle = computed<string | null>(() => {
  // 优先级：1) dashboard credit 接口的 current_subscribe_title 字段；2) fallback
  if (store.dashboardCredit?.current_subscribe_title) {
    return store.dashboardCredit.current_subscribe_title;
  }
  return store.usage?.plan?.tier ? `Token Plan · ${store.usage.plan.tier}-月度会员` : null;
});

// 提取 tier 名（如 "Max" / "Ultra"），从 title 字符串里抓
const currentTier = computed<string | null>(() => {
  const fromStore = store.usage?.plan?.tier;
  if (fromStore) return fromStore;
  const t = dashboardTitle.value;
  if (!t) return null;
  // 抓 "Plus" / "Max" / "Ultra" 等
  const m = /(Plus|Max|Ultra|Starter)/i.exec(t);
  return m ? m[1] : null;
});

const planMeta = computed<PlanMeta | null>(() => {
  const t = currentTier.value;
  if (!t) return null;
  return PLAN_META[t] ?? null;
});

// 积分余额
const credit = computed(() => store.dashboardCredit);
// 只要 credit 拿到了（接口成功）就显示，即使余额为 0 也是有意义的"已用完"提示
const hasCredits = computed(() => !!credit.value);

function fmtNumber(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toLocaleString("zh-CN");
}
</script>

<template>
  <section
    v-if="planMeta || dashboardTitle || hasCredits"
    class="card subscription-card"
  >
    <div class="card-header">
      <span class="card-title">订阅 & 积分</span>
      <span v-if="store.dashboardIsLoading" class="card-subtitle">加载中…</span>
    </div>

    <div v-if="planMeta" class="plan-block">
      <div
        class="plan-pill"
        :style="{ '--plan-color': planMeta.color }"
      >
        <span class="plan-tier">{{ planMeta.tier }}</span>
      </div>
      <div class="plan-meta">
        <div class="plan-title">{{ dashboardTitle || `Token Plan · ${planMeta.tier}` }}</div>
        <div class="plan-price">{{ planMeta.priceLabel }}</div>
      </div>
    </div>

    <div v-if="credit" class="credit-block">
      <div class="credit-row">
        <span class="credit-label">总积分</span>
        <span class="credit-value">{{ fmtNumber(credit.total_credits) }}</span>
      </div>
      <div class="credit-row">
        <span class="credit-label">已使用</span>
        <span class="credit-value">{{ fmtNumber(credit.used_credits) }}</span>
      </div>
      <div class="credit-row highlight">
        <span class="credit-label">剩余</span>
        <span class="credit-value">{{ fmtNumber(credit.remaining_credits) }}</span>
      </div>
      <div
        v-if="credit.balance_breakdown?.buckets?.length"
        class="credit-buckets"
      >
        <span class="bucket-label">余额分布</span>
        <div
          v-for="(b, i) in credit.balance_breakdown.buckets"
          :key="i"
          class="bucket"
        >
          <span class="bucket-name">{{ b.name }}</span>
          <span class="bucket-value">{{ fmtNumber(b.balance) }}</span>
          <span v-if="b.expires_at" class="bucket-expire">
            到期 {{ b.expires_at.slice(0, 10) }}
          </span>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.subscription-card {
  display: grid;
  gap: 14px;
}

.plan-block {
  display: flex;
  align-items: center;
  gap: 14px;
}

.plan-pill {
  width: 60px;
  height: 60px;
  border-radius: 14px;
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--plan-color) 30%, transparent),
    color-mix(in srgb, var(--plan-color) 15%, transparent)
  );
  border: 1px solid var(--plan-color);
  display: grid;
  place-items: center;
  flex-shrink: 0;
}

.plan-tier {
  font-size: 18px;
  font-weight: 700;
  color: var(--plan-color);
  letter-spacing: -0.02em;
}

.plan-meta {
  display: grid;
  gap: 4px;
}

.plan-title {
  color: #e6e8ef;
  font-weight: 500;
  font-size: 14px;
}

.plan-price {
  color: #8b92a5;
  font-size: 12px;
}

.credit-block {
  display: grid;
  gap: 8px;
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid #232733;
  border-radius: 10px;
  padding: 12px 14px;
}

.credit-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  font-size: 13px;
}

.credit-row.highlight {
  border-top: 1px dashed #2a2f3a;
  padding-top: 8px;
  margin-top: 4px;
}

.credit-row.highlight .credit-value {
  font-size: 18px;
  font-weight: 600;
  color: #4ade80;
}

.credit-label {
  color: #8b92a5;
}

.credit-value {
  color: #e6e8ef;
  font-feature-settings: "tnum";
}

.credit-buckets {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px dashed #2a2f3a;
  display: grid;
  gap: 4px;
}

.bucket-label {
  font-size: 11px;
  color: #6c7384;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.bucket {
  display: flex;
  align-items: baseline;
  gap: 10px;
  font-size: 12px;
}

.bucket-name {
  color: #c2cadb;
}

.bucket-value {
  color: #e6e8ef;
  font-feature-settings: "tnum";
}

.bucket-expire {
  color: #6c7384;
  font-size: 11px;
}
</style>