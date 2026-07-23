# 安全策略

## 支持的版本

| 版本 | 支持状态 |
|---|---|
| 0.1.x | ✅ 积极维护 |

## 报告漏洞

**不要在 GitHub issue 里公开报告安全问题**。

请私下发邮件给维护者，附上：

- 漏洞描述 + 复现步骤
- 潜在影响
- 可能的修复思路（可选）

## 隐私说明

本工具**不上传任何数据**到任何服务：

- API Key 只存浏览器 localStorage
- Dashboard cookie 存在 Electron 独立 partition `persist:minimax-auth`，
  跨重启有效，但**只在本机**，不会发出去
- 所有 MiniMax API 调用直接 `https://www.minimaxi.com/...`，
  没有中间代理

### 用户在 issue / PR 里需要避免

- 贴出真实 API Key（`sk-cp-...` 开头）
- 贴出真实 cookie / JWT / group_id
- 贴出真实邮箱 / 手机号

`src/lib/minimax.test.mjs` 里的测试 fixture 是**假的**，可以贴。