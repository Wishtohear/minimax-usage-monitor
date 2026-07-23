# 更新日志

本项目所有显著改动会记录在此文件。格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)。

## [Unreleased]

### 计划中
- 多账户 Key 轮询
- 历史用量曲线持久化
- 阈值通知中心
- 适配其他平台（OpenAI / Anthropic 等）

## [0.1.0] - 2026-07-23

首个发布版本。

### 新增
- **基础架构**：Electron 33 + Vue 3 + Vite + TypeScript + Pinia
- **API Key 鉴权**：
  - 主卡片显示主模型 5h 窗口用量（已用% / 剩余%）+ 倒计时
  - 周配额卡（已用 0% 时显示绿色「不限额」pill）
  - 模型用量明细列表
  - 状态栏（实时状态点 / 最后更新时间 / 下次刷新倒计时）
  - 原始响应折叠面板，方便核对字段
  - 5 分钟自动轮询（可在设置中改为 1 / 5 / 15 / 30 分钟）
- **2026 改版适配**：识别 `current_interval_remaining_percent` 权威字段，
  兼容绝对 count 字段
- **Primary model 选取策略**：跳过空占位 model（total=0/usage_count=0），
  优先选有 percent 字段的
- **套餐类型识别**：从 API 顶层字段或 5h 额度反推 Plus/Max/Ultra，
  头部显示彩色徽章（Plus 青、Max 紫、Ultra 粉）
- **计费模式标签**：从 dashboard 登录后的 `current_subscribe_title` 自动识别
  Token Plan / 按量付费
- **Dashboard 内嵌登录**：
  - Electron BrowserWindow 用独立 partition `persist:minimax-auth` 持久化 cookie
  - 自动检测 `_token` + `minimax_group_id_v2` cookie 出现后关窗 + 自动查数据
  - 主进程用 `session.fetch` 调 dashboard API（自带 cookie、绕 CORS）
- **Dashboard 数据展示**：
  - 订阅 & 积分卡（套餐标题 / 价格 / 总积分 / 已用 / 剩余）
  - 累计用量卡（6 大数字：累计 / 近 7 天 / 近 30 天 / 单日峰值 / 活跃天数 / 连续天数）
  - 调用趋势折线图（纯 SVG 自绘，可切 7 天 / 30 天）
  - 调用热力图（GitHub contribution 风格，log 颜色等级，hover 看明细）
  - 价格对照表（8 个主流模型 × 3 时间维度，人民币 ¥ + 万 / 亿）
- **价格模块**：
  - 8 个主流模型定价（DeepSeek V3/R1、GPT-4o/mini、Claude Sonnet/Haiku、Gemini Pro/Flash）
  - 输入 20% / 输出 80% 比例拆分（可配置）
  - 固定汇率 USD_TO_CNY = 7.2
  - `formatCNY`：自动加单位（元 / 万 / 亿）
- **测试**：minimax 模块 54 断言 + pricing 模块 48 断言，**共 102 个断言全过**
- **构建**：bundle 约 43 KB gzipped，零图表库依赖（纯 SVG 自绘）

### 已知问题
- `current_subscribe_title` 字段只在 dashboard 登录后才有，
  未登录时主卡「计费模式」显示 `--`
- 按量付费账号的「积分余额」永远是 0（API 真实返回值，不是 bug）
- miniMax dashboard Chrome 浏览器被 captcha 拦截时，
  工具不受影响：主进程用独立 session 调 API，不走浏览器
- 1004 错误码现在的语义是「鉴权失败 / cookie 缺失」，
  不再只是「API Key 错」

### 致谢
- 数据源参考：[Eyozy/minimax-usage](https://github.com/Eyozy/minimax-usage)
- 字段语义确认：[hongjiahao371-pixel/minimax-quota](https://clawhub.ai/hongjiahao371-pixel/minimax-quota)
- Percent 字段适配：[robinebers/openusage](https://github.com/robinebers/openusage/blob/main/docs/providers/minimax.md)
- 价格数据参考：[DeepSeek pricing](https://api-docs.deepseek.com/zh-cn/quick_start/pricing)