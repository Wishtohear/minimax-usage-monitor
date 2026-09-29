<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useUsageStore } from "@/stores/usage";
import type { HourlyDetailEntry } from "@/types/usage";

const store = useUsageStore();

type BizFilter = "all" | "Text" | "Tool";

const startDate = ref<string>("");
const endDate = ref<string>("");
const bizFilter = ref<BizFilter>("all");
const modelFilter = ref<string>("");
const showAll = ref<boolean>(false);

function initDates() {
  const today = store.todayUtc8();
  startDate.value = today;
  endDate.value = today;
}

function query() {
  if (!startDate.value || !endDate.value) return;
  store.loadHourlyDetail(startDate.value, endDate.value);
}

onMounted(() => {
  if (!startDate.value) {
    initDates();
    query();
  }
});

// 可选模型列表（从已加载的数据里提取）
const allEntries = computed<HourlyDetailEntry[]>(
  () => store.dashboardHourlyDetail?.entries ?? []
);

const modelOptions = computed(() => {
  const set = new Set<string>();
  for (const e of allEntries.value) set.add(e.model);
  return Array.from(set).sort();
});

const filtered = computed(() => {
  let rows = allEntries.value;
  if (bizFilter.value !== "all") {
    rows = rows.filter((e) => e.biz_type === bizFilter.value);
  }
  const kw = modelFilter.value.trim().toLowerCase();
  if (kw) {
    rows = rows.filter((e) => e.model.toLowerCase().includes(kw));
  }
  return rows;
});

const shown = computed(() => (showAll.value ? filtered.value : filtered.value.slice(0, 50)));

const isLoading = computed(() => store.dashboardIsLoading);

function human(n: number | undefined): string {
  if (n == null) return "—";
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toLocaleString("zh-CN");
}

function exportCsv() {
  const header = [
    "时间",
    "模型/工具",
    "类型",
    "来源",
    "输入Token",
    "输出Token",
    "缓存读取",
    "缓存写入",
    "Cache命中率(%)",
    "数量",
  ];
  const lines = filtered.value.map((e) =>
    [
      e.time_range,
      e.model,
      e.biz_type,
      e.source,
      e.input_token ?? "",
      e.output_token ?? "",
      e.cache_read_token ?? "",
      e.cache_create_token ?? "",
      e.cache_hit_percent ?? "",
      e.media_or_tool_count ?? "",
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(",")
  );
  // BOM 让 Excel 正确识别 UTF-8
  const csv = "\uFEFF" + [header.map((h) => `"${h}"`).join(","), ...lines].join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `minimax-usage-${startDate.value}_${endDate.value}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

watch(
  () => store.dashboardHourlyDetail,
  () => {
    showAll.value = false;
  }
);
</script>

<template>
  <section class="card detail-card" v-if="store.hasDashboardSession">
    <div class="card-header">
      <span class="card-title">用量明细（UTC+8）</span>
      <span v-if="isLoading" class="card-subtitle">加载中…</span>
      <span v-else-if="store.dashboardHourlyDetail" class="card-subtitle">
        {{ filtered.length }} / {{ allEntries.length }} 条
        <template v-if="store.dashboardHourlyDetail.has_more">（接口返回已截断）</template>
      </span>
    </div>

    <!-- 查询条件 -->
    <div class="filters">
      <label class="field">
        <span class="field-label">开始日期</span>
        <input v-model="startDate" type="date" class="input" />
      </label>
      <label class="field">
        <span class="field-label">结束日期</span>
        <input v-model="endDate" type="date" class="input" />
      </label>
      <div class="field">
        <span class="field-label">类型</span>
        <div class="seg">
          <button
            v-for="f in [
              { k: 'all', l: '全部' },
              { k: 'Text', l: '仅模型' },
              { k: 'Tool', l: '仅工具' },
            ]"
            :key="f.k"
            class="seg-btn"
            :class="{ active: bizFilter === f.k }"
            @click="bizFilter = f.k as BizFilter"
          >
            {{ f.l }}
          </button>
        </div>
      </div>
      <label class="field grow">
        <span class="field-label">模型 / 工具</span>
        <input
          v-model="modelFilter"
          class="input"
          list="model-options"
          placeholder="输入关键字过滤"
        />
        <datalist id="model-options">
          <option v-for="m in modelOptions" :key="m" :value="m" />
        </datalist>
      </label>
      <div class="actions">
        <button class="btn btn-primary" :disabled="isLoading" @click="query">查询</button>
        <button
          class="btn btn-secondary"
          :disabled="filtered.length === 0"
          @click="exportCsv"
        >
          导出 CSV
        </button>
      </div>
    </div>

    <div v-if="store.dashboardError" class="hint error">{{ store.dashboardError }}</div>

    <!-- 表格 -->
    <div v-if="shown.length" class="table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th>时间</th>
            <th>模型 / 工具</th>
            <th>类型</th>
            <th>输入 Token</th>
            <th>输出 Token</th>
            <th>缓存读取</th>
            <th>缓存写入</th>
            <th>Cache 命中率</th>
            <th>数量</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(e, i) in shown" :key="i">
            <td class="mono nowrap">{{ e.time_range }}</td>
            <td class="mono">{{ e.model }}</td>
            <td>
              <span class="tag" :class="e.biz_type === 'Tool' ? 'tag-tool' : 'tag-text'">
                {{ e.biz_type === 'Tool' ? '工具' : '模型' }}
              </span>
            </td>
            <td class="num">{{ human(e.input_token) }}</td>
            <td class="num">{{ human(e.output_token) }}</td>
            <td class="num">{{ human(e.cache_read_token) }}</td>
            <td class="num">{{ human(e.cache_create_token) }}</td>
            <td class="num">{{ e.cache_hit_percent != null ? e.cache_hit_percent + "%" : "—" }}</td>
            <td class="num">{{ e.media_or_tool_count ?? "—" }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-else-if="isLoading" class="empty">
      <div class="empty-icon">⏳</div>
      <div>加载中…</div>
    </div>

    <div v-else class="empty">
      <div class="empty-icon">🔍</div>
      <div>{{ allEntries.length === 0 ? "点击「查询」加载用量明细" : "没有符合筛选条件的数据" }}</div>
    </div>

    <div v-if="filtered.length > shown.length" class="more">
      <button class="btn btn-secondary" @click="showAll = true">
        展开全部 {{ filtered.length }} 条
      </button>
    </div>
  </section>
</template>

<style scoped>
.detail-card {
  display: grid;
  gap: 14px;
}

.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 14px;
  align-items: flex-end;
}

.field {
  display: grid;
  gap: 4px;
}

.field.grow {
  flex: 1;
  min-width: 160px;
}

.field-label {
  font-size: 11px;
  color: #6c7384;
}

.input {
  padding: 5px 9px;
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid #232733;
  border-radius: 8px;
  color: #e6e8ef;
  font-size: 12px;
  font-family: inherit;
}

.input:focus {
  outline: none;
  border-color: rgba(80, 120, 255, 0.5);
}

.seg {
  display: inline-flex;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid #232733;
  border-radius: 8px;
  padding: 2px;
  gap: 2px;
}

.seg-btn {
  padding: 4px 10px;
  font-size: 12px;
  color: #8b92a5;
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}

.seg-btn.active {
  background: rgba(80, 120, 255, 0.18);
  color: #e6e8ef;
}

.actions {
  display: flex;
  gap: 8px;
}

.btn {
  padding: 6px 14px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid transparent;
  transition: background 0.15s ease, filter 0.15s ease;
}

.btn-primary {
  background: linear-gradient(135deg, #5865f2, #a855f7);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  filter: brightness(1.08);
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.04);
  color: #c2cadb;
  border-color: #2a2f3a;
}

.btn-secondary:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.08);
}

.btn:disabled {
  opacity: 0.5;
  cursor: default;
}

.table-wrap {
  overflow-x: auto;
  border: 1px solid #232733;
  border-radius: 10px;
}

.table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
  min-width: 880px;
}

.table th {
  text-align: left;
  padding: 8px 10px;
  background: rgba(255, 255, 255, 0.03);
  color: #8b92a5;
  font-weight: 500;
  white-space: nowrap;
  position: sticky;
  top: 0;
}

.table td {
  padding: 6px 10px;
  border-top: 1px solid rgba(255, 255, 255, 0.04);
  color: #c2cadb;
}

.table tbody tr:hover {
  background: rgba(255, 255, 255, 0.03);
}

.num {
  text-align: right;
  font-feature-settings: "tnum";
}

.mono {
  font-family: ui-monospace, "JetBrains Mono", Menlo, Consolas, monospace;
}

.nowrap {
  white-space: nowrap;
}

.tag {
  padding: 1px 8px;
  border-radius: 999px;
  font-size: 11px;
  border: 1px solid transparent;
}

.tag-text {
  background: rgba(80, 120, 255, 0.12);
  color: #93b0ff;
  border-color: rgba(80, 120, 255, 0.3);
}

.tag-tool {
  background: rgba(167, 139, 250, 0.12);
  color: #c4b5fd;
  border-color: rgba(167, 139, 250, 0.3);
}

.hint {
  font-size: 12px;
  padding: 8px 12px;
  border-radius: 8px;
}

.hint.error {
  color: #fca5a5;
  background: rgba(248, 113, 113, 0.08);
  border: 1px solid rgba(248, 113, 113, 0.25);
}

.more {
  display: flex;
  justify-content: center;
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
