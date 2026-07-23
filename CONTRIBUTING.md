# 贡献指南

感谢你愿意贡献！🎉 任何形式的贡献都受欢迎：bug 反馈、功能建议、文档改进、
代码提交。

## 🐛 反馈 Bug

提交 issue 时请附带：

- 工具版本（看 commit hash 或 tag）
- 操作系统 + 版本
- MiniMax 账号类型（订阅 / 按量付费）
- 复现步骤（越具体越好）
- 期望行为 vs 实际行为
- 截图 / 日志 / 原始 JSON（如果有）

**最有效的诊断信息**：在工具里点页面底部的「查看 MiniMax 原始响应」
折叠面板，把 JSON 复制出来贴上 —— 一眼就能看出是字段名变了还是别的。

## 💡 提议功能

先开 issue 描述清楚：

- 想解决什么问题
- 期望的交互方式
- 有没有参考的截图 / 竞品

我会尽快回复是否可以接。

## 🔧 提交代码

### 开发环境

```bash
git clone <repo>
cd minimax-usage-monitor
npm install
npm run dev
```

### 提交前检查清单

```bash
npm run build:electron   # 主进程 TS 编译
npx vue-tsc --noEmit     # 前端 TS 类型检查
npm test                 # 单元测试（应保持 100% 通过）
npm run build            # 完整构建
```

### 代码规范

- TypeScript strict 模式，不要用 `any`（除非真没办法）
- Vue 组件用 `<script setup lang="ts">`
- CSS 用 scoped，深色主题色值参考 `src/styles/main.css`
- 提交前跑 `npm test`，新增功能顺手补测试
- commit message 写清楚"为什么"，不只"做了什么"

### 文件组织

- 新组件放 `src/components/`
- 纯函数 / 数据格式化放 `src/lib/`
- 类型放 `src/types/usage.ts`
- 测试用 `.test.mjs` 后缀，跑 `npm test` 自动捡

## 📦 发布流程

1. bump version：`npm version patch | minor | major`
2. 更新 `CHANGELOG.md` 的 `[Unreleased]` 段
3. 打 tag 并 push：`git tag v0.x.y && git push --tags`
4. GitHub Actions 自动构建并出 release 包（`release/`）

## 🤝 行为准则

- 友善、专业、不人身攻击
- 不要用 issue 区问"怎么样才能 X"——直接说"我打算加 X，思路是 Y，反馈一下"
- 涉及他人隐私时脱敏（API Key / cookie / group_id 绝不能贴出来）