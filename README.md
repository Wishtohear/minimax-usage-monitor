<div align="center">

# MiniMax 用量监控

**一个监控 [MiniMax Token Plan](https://platform.minimax.cn/docs/coding-plan/faq) 用量的桌面小工具**

基于 **Electron + Vue 3 + TypeScript**，每 5 分钟自动刷新。

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Platform: Win/macOS/Linux](https://img.shields.io/badge/Platform-Win%20%7C%20macOS%20%7C%20Linux-lightgrey.svg)](#)
[![Node: >= 20](https://img.shields.io/badge/Node-%3E%3D20-339933.svg)](https://nodejs.org)
[![Bundle: ~43 KB gzipped](https://img.shields.io/badge/Bundle-~43%20KB%20gzipped-22c55e.svg)](#)
[![Tests: 102 passing](https://img.shields.io/badge/Tests-102%20passing-success.svg)](https://github.com/)

[功能特性](#功能特性详细) ·
[快速开始](#-快速开始) ·
[API 文档](#数据源-1api-key-鉴权) ·
[贡献指南](./CONTRIBUTING.md) ·
[更新日志](./CHANGELOG.md)

</div>

---

## ✨ 功能特性

- 🎯 **5h 窗口 + 周窗口**实时用量（已用% / 剩余%）
- 📊 **累计 / 近 7 天 / 近 30 天** token 调用量（6 大数字卡）
- 📈 **调用趋势折线图**（纯 SVG 自绘，可切 7 天 / 30 天）
- 🗓️ **调用热力图**（GitHub contribution 风格，log 颜色等级，hover 看明细）
- 💰 **价格对照**：8 个主流模型（DeepSeek / GPT-4o / Claude / Gemini）× 3 时间维度，
  按 20% 输入 / 80% 输出比例自动算"如果你用别家会花多少"
- 🏷️ **套餐 & 积分**：从 dashboard 自动识别 TokenPlan / 按量付费，显示积分余额
- ⏰ **自动 5 分钟轮询**（可在设置里调 1 / 5 / 15 / 30 分钟）
- 🔌 **双数据源**：API Key（Bearer）拿 5h/周窗口；Dashboard 登录（内嵌浏览器）
  拿累计 / 趋势 / 热力图 / 积分
- 🎨 **深色卡片 UI**：纯原生 CSS，零 UI 库依赖，bundle **~43 KB gzipped**

请求方式与字段映射参考了 [Eyozy/minimax-usage](https://github.com/Eyozy/minimax-usage)。

---

## 📸 截图

> 截图占位 — 跑起来后欢迎提 PR 替换

| 主窗口 | Dashboard 登录后 |
|---|---|
| ![主窗口](docs/screenshots/main.png) | ![Dashboard](docs/screenshots/dashboard.png) |

---

## 双数据源

| 鉴权方式 | 数据范围 | 何时需要 |
|---|---|---|
| **API Key**（Bearer） | 5h 窗口 / 周窗口 / 各模型用量 / 套餐等级 | 必填，否则主卡都看不到 |
| **Dashboard 登录**（内嵌浏览器 + cookie） | 累计 / 近 7 天 / 近 30 天 / 折线 / 热力图 / 积分 / 套餐标题 | 想看更多数据时点"在应用内登录 MiniMax" |

> **Dashboard 数据是从 `platform.minimax.cn/console/usage` 后端抓的**，
> 不是 OpenAPI。需要在工具里点登录按钮，cookie 存在独立的
> `persist:minimax-auth` session 里，跨重启有效。

---

## 功能特性（详细）

### API Key 鉴权（基础，必填）

- **主卡片**：主模型 5h 窗口进度条（已用% / 剩余%）+ 倒计时
- **计费模式标签**：`Token Plan`（紫）或 `按量付费`（青）
- **积分余额**：高亮绿色，显示「剩余 / 总积分」
- **周配额卡片**：周窗口进度；**已用 0% 时显示「不限额」绿色 pill**
- **模型用量明细**：每个模型一行，进度条 + 已用百分比
- **状态栏**：实时状态点、最后更新时间、下次刷新倒计时、错误信息
- 自动每 5 分钟查询（默认，可在设置中调整 1 / 5 / 15 / 30 分钟）
- 手动刷新按钮
- **原始响应折叠面板**：随时查看 MiniMax 实际返回的 JSON，方便核对字段
- API Key 仅存浏览器 localStorage，不上传任何服务

### Dashboard 登录鉴权（进阶，登录后才有）

- **订阅 & 积分卡**：60×60 渐变方块 + 套餐标题 + 价格 + 积分三件套
- **累计用量卡**：6 大数字 — 累计 / 近 7 天 / 近 30 天 / 单日峰值 / 活跃天数 / 连续天数
- **调用趋势折线图**：纯 SVG 自绘，7 天 / 30 天切换
- **调用热力图**：GitHub contribution 风格，120+ 天日历按周横向排，log scale 6 级颜色
- **价格对照表**：8 个模型 × 3 时间维度的理论花费（人民币 ¥ + 万 / 亿）
- 登录窗口自动检测 `_token` cookie 出现，登录成功自动关窗 + 自动查数据
- 下次启动免登录（cookie 持久化在独立 partition）

---

## 项目结构

```
.
├── electron/
│   ├── main.ts          # 主进程：创建主窗 + 登录窗 + IPC 路由
│   └── preload.ts       # 预加载：暴露 electronAPI
├── src/
│   ├── App.vue          # 根组件
│   ├── main.ts          # Vue 入口
│   ├── components/
│   │   ├── ApiKeyPanel.vue            # API Key 输入
│   │   ├── LoginPanel.vue             # Dashboard 登录 / 登出面板
│   │   ├── PlanBadge.vue              # 头部套餐徽章
│   │   ├── PrimaryUsageCard.vue       # 5h 主卡 + 计费模式 + 积分余额
│   │   ├── WeeklyQuotaCard.vue        # 周配额（含「不限额」判断）
│   │   ├── ModelListCard.vue          # 各模型明细
│   │   ├── SubscriptionInfoCard.vue   # 订阅 & 积分三件套
│   │   ├── SubscriptionSummaryCard.vue# 累计 / 近 7 天 / 近 30 天 6 大数字
│   │   ├── UsageTrendCard.vue         # 折线图
│   │   ├── UsageHeatmapCard.vue       # 日历热力图
│   │   ├── PricingComparisonCard.vue  # 8 模型 × 3 维度价格对照
│   │   └── StatusBar.vue              # 状态条
│   ├── composables/
│   │   └── useCountdown.ts            # 倒计时 hook
│   ├── stores/
│   │   └── usage.ts                   # Pinia: API Key + dashboard session
│   ├── lib/
│   │   ├── minimax.ts                 # /coding_plan/remains 调用 + 字段映射
│   │   └── pricing.ts                 # 8 模型定价 + CNY 换算
│   ├── types/
│   │   └── usage.ts                   # 全量类型定义
│   └── styles/
│       └── main.css                   # 全局深色样式
├── index.html
├── package.json
├── tsconfig.json
├── tsconfig.electron.json
└── vite.config.ts
```

---

## 🚀 快速开始

```bash
# 安装依赖
npm install

# 开发模式（Vite + Electron 热重载）
npm run dev

# 构建 + 启动（生产）
npm run build
npm start

# 打包成安装包（输出到 release/）
npm run dist

# 单元测试（验证字段映射 / primary model / pricing）
npm test
```

---

## 数据源 1：API Key 鉴权

### 端点

- **URL**：`https://www.minimax.cn/v1/api/openplatform/coding_plan/remains`
- **方法**：`GET`
- **请求头**：`Authorization: Bearer <API Key>`
- **超时**：15 秒

### 关键字段含义

> ⚠️ **2026 改版之后，主套餐（即 `general` 模型）不再返回 absolute count，
> 而是返回 `current_interval_remaining_percent`（剩余百分比）作为权威字段。**
> 已用百分比 = `100 - current_interval_remaining_percent`。
>
> 具体模型（如 `video`、`MiniMax-M2.7`）仍同时返回 absolute count 和 percent。

| 字段 | 含义 |
| --- | --- |
| `model_remains[].model_name` | 模型名（套餐主用量通常叫 `general`） |
| `model_remains[].current_interval_remaining_percent` | 5h 窗口剩余百分比（**权威字段**，0~100） |
| `model_remains[].current_interval_total_count` | 5h 窗口总额度（具体模型才有，套餐主可能为 0） |
| `model_remains[].current_interval_usage_count` | 5h 窗口**剩余**额度（注意：不是已用！具体模型才有） |
| `model_remains[].remains_time` | 距离窗口重置的毫秒数 |
| `model_remains[].start_time` / `end_time` | 当前窗口起止时间戳 |
| `model_remains[].current_weekly_remaining_percent` | 本周剩余百分比 |
| `model_remains[].current_weekly_total_count` | 本周总额度（可能为 0） |
| `model_remains[].current_weekly_usage_count` | 本周**剩余**额度 |
| `model_remains[].weekly_remains_time` / `weekly_end_time` | 距离周重置的时间 |
| `base_resp.status_code` | 0 = 成功；1004 = 鉴权失败（Key 错或 cookie 缺失） |

**主套餐（如 general）的数据流示例**：

- API 返回 `current_interval_remaining_percent = 83`
- 工具展示：剩余 **83%** / 已用 **17%**
- 模型列表里同名卡片也按此 percent 计算，进度条停在 17% 处

### Primary model 选取策略

按优先级：

1. **优先选有 `current_interval_remaining_percent` 字段的 model**（这才是套餐主用量的权威数据）
2. 否则选第一个有 absolute count 的 model
3. 都拿不到就回退 `models[0]`（保证 UI 不崩）

这是因为 2026 改版后：`model_remains` 数组的第一个 model（`general`）
absolute count 是 0/0，但 percent 字段才是真正的用量。如果直接取 `models[0]`
然后按 count 算，就会显示 0/0。

### 字段计算公式（兼容旧字段）

如果只有 absolute count 没有 percent：
- `已用 = current_interval_total_count - current_interval_usage_count`
  （注意 `usage_count` 是「剩余」不是「已用」）
- `剩余 = current_interval_usage_count`

如果两者都有，**percent 优先**。

### 套餐类型识别

`PrimaryUsageCard` 的「计费模式」标签从 dashboard 登录后的
`current_subscribe_title` 字段判断：

| 标题匹配 | 标签 | 颜色 |
|---|---|---|
| `TokenPlan` / `Token Plan` | Token Plan | 紫 (#a78bfa) |
| `按量付费` / `PAYG` | 按量付费 | 青 (#22d3ee) |
| 兜底「月度/年度/membership」 | Token Plan | 紫 |

未登录 dashboard 时显示 `--`，并在右边给一行引导让你去点登录。

---

## 数据源 2：Dashboard 登录鉴权

### 抓取的端点（用 Chrome DevTools MCP 验证过）

数据源是 `https://platform.minimax.cn/console/usage` 页面后端，鉴权是
**cookie + x-group-id header**。共 6 个端点：

| 端点 | 用途 |
|---|---|
| `/backend/account/token_plan/usage_summary` | 累计 / 近 7 天 / 近 30 天 / 活跃天数 / 每日明细 |
| `/backend/account/token_plan/remains_percent` | 5h / 周窗口（字段命名比 OpenAPI 干净） |
| `/backend/account/token_plan_credit` | 积分余额 + 套餐标题 + subscription key |
| `/backend/account/token_plan/usage_overview?period=day\|week\|month` | 用量总览 + 每日趋势（按模型堆叠） |
| `/backend/account/token_plan/usage_hourly_detail?start_time=&end_time=` | 用量明细表（小时级，UTC+8） |
| `/v1/api/openplatform/charge/token_plan/usage` | 调用量明细（备选源） |

### 登录流程

1. 在「**Dashboard 登录态**」面板点 **「在应用内登录 MiniMax」**
2. 弹窗打开 `https://platform.minimax.cn/console/usage`（微信扫码 / 手机号都行）
3. 登录成功**窗口自动关**，主窗口立刻多出 4 大数字 + 折线 + 热力图
4. **下次启动免登录**：cookie 存在独立的 `persist:minimax-auth` session

主进程的实现：
- 独立 partition `persist:minimax-auth` 持久化 cookie
- 加载 dashboard URL 后，**轮询 `webContents.session.cookies.get({})`**（不带 domain 过滤，兼容 `platform.minimax.cn` 和 `www.minimax.cn` 两套域）
- 检测到 `_token` + `minimax_group_id_v2` 同时存在 → 通知主窗口 + 关闭窗口
- 主进程用 `session.fromPartition('persist:minimax-auth').fetch()` 调 dashboard API，**自动带 cookie、绕 CORS**

### usage_overview 关键字段（用量总览 + 每日趋势）

`period` 决定 `trend[].time_label` 的语义：

| period | time_label | 场景 |
|---|---|---|
| `day` | `"00:00"` ~ `"23:00"` | 当日（按小时，24 个桶） |
| `week`

### usage_summary 关键字段

```json
{
  "total_days": 125,
  "total_token_consumed": "17.70B",   // 累计
  "usage_ranking_percent": 1,        // 百分位排名
  "most_active_day": {                // 单日峰值
    "date": "2026-07-19",
    "token_count": "990.54M"
  },
  "active_days": 117,                 // 活跃天数
  "current_consecutive_days": 0,      // 连续天数
  "daily_token_usage": [...],         // 每日 token 数（老→新）
  "date_model_usage": [...]           // 每日每模型明细
}
```

---

## 价格对照（`src/lib/pricing.ts`）

参考 [DeepSeek pricing](https://api-docs.deepseek.com/zh-cn/quick_start/pricing) 等
8 个主流模型定价（USD/1M tokens）：

| 模型 | 输入 | 输出 |
|---|---|---|
| DeepSeek-V3 | $0.14 | $0.28 |
| DeepSeek-R1 | $0.14 | $2.19 |
| GPT-4o | $2.5 | $10.0 |
| GPT-4o mini | $0.15 | $0.6 |
| Claude Sonnet 4 | $3.0 | $15.0 |
| Claude Haiku 3.5 | $0.8 | $4.0 |
| Gemini 1.5 Pro | $1.25 | $5.0 |
| Gemini 1.5 Flash | $0.075 | $0.3 |

**比例拆分**：输入 20% / 输出 80%（用户给的默认值，可用 `DEFAULT_INPUT_RATIO` 改）

**展示单位**：自动按大小加单位 — `¥533.13` / `¥5,500` / `¥1.50 万` / `¥1500 万` / `¥15.0 亿`，
固定汇率 `USD_TO_CNY = 7.2`（如需改在 `src/lib/pricing.ts` 里调整）

### `formatCNY` 单位对照

| 输入 | 输出 |
|---|---|
| 533.13 | `¥533.13` |
| 5500 | `¥5,500` |
| 15000 | `¥1.50 万` |
| 1.5e7 | `¥1500 万` |
| 1.5e9 | `¥15.0 亿` |

---

## 获取 API Key

1. 登录 [MiniMax 开放平台](https://platform.minimax.cn/)
2. 进入「接口密钥」→ 创建一个 **订阅 Key**（Token Plan 专用，与按量计费 Key 相互独立）
3. 把这串 Key 粘贴进本工具的 API Key 输入框，点保存

工具会立即发起一次查询，之后按所设间隔自动刷新。

---

## 已知坑 & 限制

- **`current_subscribe_title` 字段**只在 dashboard 登录后从 `token_plan_credit` 拿到
  —— 未登录时主卡的「计费模式」显示 `--」
- **按量付费账号的积分余额永远是 0**：dashboard 的 `token_plan_credit` 端点
  只对订阅用户返回有效数据，按量付费返回 0/0
- **dashboard Chrome 浏览器被 captcha 拦截**时，工具不受影响：主进程用
  独立 session 调 API，不走浏览器
- **1004 错误码**现在的语义是「鉴权失败 / cookie 缺失」，不再只是「API Key 错」，
  建议用 `Authorization: Bearer` 鉴权失败时同时检查 cookie 状态

---

## License

MIT
