<script setup lang="ts">
import { ref, computed } from "vue";
import { useUsageStore } from "@/stores/usage";
import type { RefreshIntervalMinutes } from "@/types/usage";

const store = useUsageStore();

const draftKey = ref<string>(store.apiKey);
const showKey = ref<boolean>(false);

const validation = computed(() => {
  if (!draftKey.value.trim()) return { ok: true, message: "" };
  if (!/^[a-zA-Z0-9_-]+$/.test(draftKey.value.trim()))
    return { ok: false, message: "API Key 格式无效" };
  if (draftKey.value.trim().length < 10)
    return { ok: false, message: "API Key 长度不足" };
  return { ok: true, message: "" };
});

const intervalOptions: RefreshIntervalMinutes[] = [1, 5, 15, 30];

function save() {
  if (!validation.value.ok) return;
  store.setApiKey(draftKey.value);
  store.refresh();
}
</script>

<template>
  <section class="card api-panel">
    <div class="card-header">
      <span class="card-title">API Key &amp; 刷新设置</span>
      <span class="card-subtitle">仅保存在本地浏览器</span>
    </div>

    <div class="field">
      <label class="field-label" for="apikey-input">MiniMax Token Plan API Key</label>
      <div class="field-input">
        <input
          id="apikey-input"
          class="text-input"
          :type="showKey ? 'text' : 'password'"
          v-model="draftKey"
          placeholder="eyJhbGciOi..."
          spellcheck="false"
          autocomplete="off"
          @keydown.enter="save"
        />
        <button class="btn btn-ghost btn-icon" @click="showKey = !showKey" :title="showKey ? '隐藏' : '显示'">
          {{ showKey ? '🙈' : '👁' }}
        </button>
        <button class="btn btn-primary" :disabled="!validation.ok || !draftKey.trim()" @click="save">
          保存
        </button>
      </div>
      <div v-if="!validation.ok" class="error">{{ validation.message }}</div>
      <div class="hint">
        在
        <a href="https://platform.minimax.cn/" target="_blank" rel="noopener">MiniMax 开放平台</a>
        的「接口密钥」中创建订阅 Key（Token Plan 专用 API Key）。
        本工具仅把 Key 存在浏览器本地，发往
        <code>api.minimax.cn</code> 查询用量。
      </div>
    </div>

    <div class="field">
      <label class="field-label" for="interval-select">自动刷新间隔</label>
      <div class="field-input">
        <select
          id="interval-select"
          class="select"
          :value="store.intervalMinutes"
          @change="store.setIntervalMinutes(Number(($event.target as HTMLSelectElement).value) as RefreshIntervalMinutes)"
        >
          <option v-for="n in intervalOptions" :key="n" :value="n">每 {{ n }} 分钟</option>
        </select>
        <span class="hint">默认 5 分钟，刷新会重置倒计时</span>
      </div>
    </div>
  </section>
</template>