<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount } from "vue";
import { useUsageStore } from "@/stores/usage";

const store = useUsageStore();

const dotClass = computed(() => {
  if (store.isLoading) return "spin";
  if (store.lastError) return "danger";
  if (store.usage?.ok) {
    const p = store.usage.usedPercent ?? 0;
    if (p >= 90) return "danger";
    if (p >= 70) return "warn";
    return "ok";
  }
  return "idle";
});

const updatedText = computed(() => {
  if (!store.lastUpdatedAt) return "尚未查询";
  const d = new Date(store.lastUpdatedAt);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `更新于 ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
});

const nextText = computed(() => {
  if (!store.lastUpdatedAt || !store.hasApiKey) return "倒计时 --:--";
  const target = store.lastUpdatedAt + store.intervalMinutes * 60_000;
  const remain = Math.max(target - Date.now(), 0);
  const totalSeconds = Math.floor(remain / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  const text = h > 0
    ? `${h}:${pad(m)}:${pad(s)}`
    : `${pad(m)}:${pad(s)}`;
  return `下次刷新 ${text}`;
});

const tick = ref(0);
let timer: number | null = null;
onMounted(() => {
  timer = window.setInterval(() => (tick.value++), 1000);
});
onBeforeUnmount(() => {
  if (timer != null) window.clearInterval(timer);
});
// 引用 tick 让 nextText 重算
void tick.value;
</script>

<template>
  <div class="status-bar">
    <div class="left">
      <span class="dot" :class="dotClass"></span>
      <span>{{ store.isLoading ? "正在查询…" : (store.lastError ?? "空闲") }}</span>
    </div>
    <div class="right">
      <span>{{ updatedText }}</span>
      <span>{{ nextText }}</span>
      <span>间隔 {{ store.intervalMinutes }}min</span>
    </div>
  </div>
</template>