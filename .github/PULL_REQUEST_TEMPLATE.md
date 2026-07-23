# 描述

<!-- 一两句话说清楚这次 PR 干了什么 -->

## 改动类型

- [ ] Bug 修复（不影响现有功能）
- [ ] 新功能
- [ ] 重构 / 优化
- [ ] 文档
- [ ] 测试
- [ ] 构建 / CI

## 关联 Issue

<!-- 关闭 / 关联哪个 issue，比如：closes #42 -->

## 改动清单

<!-- 关键改动点，方便 reviewer 看 -->

-

## 测试

- [ ] 我跑了 `npm test`，全部通过
- [ ] 我跑了 `npm run build`，成功
- [ ] 我跑了 `npx vue-tsc --noEmit`，无错误
- [ ] 新功能加了测试（在 `src/lib/*.test.mjs`）

## 截图（如果改了 UI）

<!-- 改 UI 时附图 -->

## 注意事项

<!-- reviewer 需要知道的：是否破坏向后兼容、是否需要迁移、是否影响 Electron 主进程 IPC 等 -->

- [ ] 没改 IPC 接口（preload.ts 没变）
- [ ] 没改 API 响应字段名（types/usage.ts 没改）
- [ ] 没碰 `persist:minimax-auth` session cookie（用户的登录态不会丢）