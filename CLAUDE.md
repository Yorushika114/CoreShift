# CoreShift · CLAUDE.md

七牛云实训营 · 语音日历工具 · 3天冲刺（2026-05-29 至 2026-05-31）

## 项目概况

- **产品**：CoreShift，语音优先的 Web/PWA 日历工具
- **团队**：两人协作，成员 A 负责 UI/日历视图/README，成员 B 负责语音识别/时间解析/存储/查询删除逻辑/测试
- **技术栈**：Next.js 14 + Tailwind CSS，Prisma + SQLite，Web Speech API，Notification API

## 分支与 PR 规范

- **每个功能开独立 feature 分支**，命名格式：`feat/<功能描述>`，例如 `feat/event-storage`
- **一个 PR 只做一件事**，不在同一 PR 里混合多个功能
- **PR 标题**必须使用 Conventional Commits 格式（见下方），评委会直接看 PR 列表
- **PR 描述**必须包含：功能说明、实现思路、测试方式（或手动验收步骤）
- **涉及共享模块时必须通知对方**：`CalendarEvent` 类型、`ParsedCommand` 类型、任何两人都依赖的接口——改动前在 PR 描述里说明影响范围，对方 review 后才合并

## Commit 格式

使用 Conventional Commits：

```
feat: 添加中文时间解析
fix: 修复"下周一"解析偏移问题
test: 补充时间解析单测
chore: 初始化 Next.js 项目结构
docs: 更新 README 运行说明
```

- 每个 commit 只做一件事
- 描述用中文，简洁说明"做了什么"

## 测试要求

- **中文时间解析函数必须有单测**，这是最容易出 bug 的模块，也是 demo 的核心路径
- 其他模块（UI 交互、语音识别、存储读写）手动验收即可
- 测试代码和对应功能代码放在同一个 PR 里提交

## 代码规范

- 文件按功能组织，不强制目录隔离
- 共享类型定义（`CalendarEvent`、`ParsedCommand`）集中放在 `types/index.ts`，单方面不得修改，改动需双方确认
- 语音识别失败必须有文字输入兜底，不能让 demo 因此崩掉

## 每日目标（参考）

| 日期 | 目标 | 成员 B 关键产出 |
|------|------|----------------|
| Day 1 | 基础闭环 | 中文时间解析（含单测）、文字指令添加事件 |
| Day 2 | 语音核心 | 语音识别接入、中文时间解析、查询/删除逻辑、确认弹窗 |
| Day 3 | 打磨演示 | 提醒通知、Demo 模式、测试补充 |
