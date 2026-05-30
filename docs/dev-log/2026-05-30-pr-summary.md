# 2026-05-30 PR 合并日报

> Day 2 冲刺（2026-05-30）共合并 **14 个 PR**（#36 ~ #50，#44 branch 已并入 #46）。
> 涵盖：设置体系重构、全局 i18n、LLM 语音理解、视图修复、PWA 离线、时间预算五大方向。

---

## 一、设置体系重构

### PR #36 — feat: 统一设置面板
**分支** `feat/settings-panel`

新增可折叠侧边栏设置面板，整合 5 项配置：12h/24h 时间格式、~15 个 IANA 时区（影响当前时间线位置）、中/英语言切换、背景图片（URL 或本地上传）、Google 日历连接/同步。新建 `SettingsContext` + `localStorage` 持久化，`lib/i18n.ts` 提供翻译表。

**关键文件**：`contexts/SettingsContext.tsx`、`lib/i18n.ts`、`components/settings/SettingsPanel.tsx`

---

### PR #37 — feat: 全局 i18n 接入 + 时区国家标签 + 周表头重复 bug 修复
**分支** `feat/i18n-global`

9 个组件全部接入 `useSettings()` + `t()`，消除硬编码中文字符串。时区选择器从 IANA 路径改为「中国 — 上海/北京」等国家标签，随语言自动切换。

**Bug 修复**：英文周表头 S/T 字母重复导致 React 协调器混乱，`MiniCalendar`、`MonthGrid`、`YearGrid` 三处改为索引 `key={i}`。

---

### PR #47 — feat: 背景图上传限制提升至 20MB
**分支** `feat/bg-upload-size-20mb`

`SettingsPanel` 文件大小校验从 2 MB → 20 MB，中英文提示同步更新。

---

### PR #48 — fix: 时间列与提醒通知跟随全局语言
**分支** `feat/i18n-time-display-reminder`

`formatTimeSlot` 新增 `lang` 参数，英文模式输出 `9:00 AM` 格式。`reminderService` 新增 `setLang()`，通知文案随语言切换中/英文。

---

## 二、语音与 NLP

### PR #39 — feat: 接入 DeepSeek LLM 实现自然语言理解
**分支** `feat/llm-nlu`

新增 `/api/llm/parse` 路由，语音文字发给 DeepSeek 解析为结构化 `ParsedCommand`；无 API Key 时静默降级回正则解析。同步新增 `/api/llm/summarize` 路由，查询日程时输出 AI 叙述摘要并 TTS 朗读。`ParsedCommand` 扩展 `queryRangeStart` / `queryRangeEnd` 字段。

**环境变量**：`DEEPSEEK_API_KEY`（可选）、`DEEPSEEK_MODEL`（默认 `deepseek-chat`）

---

### PR #41 — feat: 支持英文时间解析，警告随语言切换
**分支** `feat/english-nlp-i18n-warnings`

`parseVoiceCommand` 新增 `lang` 参数，新增 `parseEnglishTime()` 函数，支持 `tomorrow`、`next Monday`、`3 PM`、`3:30 AM` 等英文时间表达。LLM 降级路径同步传递 `lang`，修复英文输入走中文解析的问题。

---

### PR #43 — feat: 语音浮层智能摘要 + 快捷按钮 + TTS 开关
**分支** `feat/smart-summary`

语音浮层底部新增「📋 今天」「📋 本周」快捷按钮，触发专用摘要端点 `/api/llm/schedule-summary`，输出叙述性 AI 摘要（2-4 句）+ 可折叠事件列表。TTS 默认自动朗读，可通过 🔊/🔇 开关。`Intent` union 扩展 `summarize`。

---

### PR #45 — feat: 语音面板语言跟随全局设置
**分支** `feat/language-sync-voice-overlay`

`VoiceCommandOverlay` 的 `lang` 状态从硬编码 `zh-CN` 改为从全局 `language` 初始化（`en` → `en-US`）；`EventEditorPanel` 同步，`date-utils` 新增 `formatDate` / `formatTime` 按语言输出日期格式。

---

## 三、视图与 UI 修复

### PR #38 — fix: 周/日视图相邻重叠事件多列布局
**分支** `feat/event-overlap-layout`

新增 `layoutEvents()` 函数，贪心分配列索引，重叠判断用严格不等式（首尾相接不算重叠）。事件高度 `- 1px` 保留视觉间距，定位改为百分比宽度按列分配。`DayView` 增加 `pointer-events-none` 包装层避免影响格子点击。

---

### PR #40 — fix: 侧边栏设置面板截断，底部支持滚动
**分支** `fix/sidebar-settings-scroll`

侧边栏拆为固定顶部（MiniCalendar 区）+ 弹性底部（语音+设置），底部用 `flex-1 min-h-0 overflow-y-auto` 精确占满剩余高度，解决 flex 压缩导致 overflow 不触发的问题。

---

### PR #46 — fix: DayView/WeekView hydration 错误 + themeColor 迁移
**分支** `fix/hydration-layout-head`

根因：`nowTop` 在渲染函数顶层执行 `new Date()`，SSR 与客户端时刻不同导致 hydration 失败。修复：改为 `useState(null) + useEffect` 模式，SSR 阶段跳过时间线渲染，客户端挂载后再计算。同步将 `themeColor` 从 `metadata` 迁移至 `viewport` 导出，消除 Next.js 14 deprecation 警告。

---

## 四、PWA 与性能

### PR #42 — feat: PWA 离线支持 + localStorage 事件缓存
**分支** `feat/pwa-cache`

接入 `@ducanh2912/next-pwa`，生产构建自动生成 Workbox Service Worker，缓存 App Shell 和静态资源，断网可正常访问。`fetchEvents` 实现 Stale-While-Revalidate：先从 `coreshift_events_cache` 立即渲染，再后台更新，消除白屏等待。新增 `public/manifest.json` 支持桌面安装。

---

### PR #50 — fix: dev 模式自动注销残留 Service Worker
**分支** `fix/dev-sw-unregister`

生产构建后切回 dev 模式，旧 SW 拦截请求导致白屏。在 `layout.tsx` 注入内联 `<script>`，仅 dev 模式执行 `navigator.serviceWorker.getRegistrations().then(r => r.forEach(s => s.unregister()))`，早于 React 代码运行，确保旧 SW 自动清除。

---

## 五、新功能

### PR #49 — feat: 时间预算功能
**分支** `feat/time-budget`

Prisma schema 新增 `TimeBudget` 表（标签、关键词、每周目标分钟数、颜色）。通过关键词匹配本周事件标题累计时长，计算完成百分比。侧边栏小日历下方新增 `BudgetPanel` 进度条面板（支持 visibilitychange / focus / budget-updated 事件刷新）。`BudgetEditModal` 支持目标增删改。语音层新增 `budget_query`（查询进度）和 `budget_create`（语音创建目标）两个 intent。

**新增文件**：`app/api/budgets/route.ts`、`app/api/budgets/[id]/route.ts`、`app/api/budgets/progress/route.ts`、`components/budget/BudgetPanel.tsx`、`components/budget/BudgetEditModal.tsx`

---

## 统计

| 类别 | PR 数 | 关键产出 |
|------|-------|---------|
| 设置体系 | 4 | SettingsContext、全局 i18n、时区/语言/背景 |
| 语音与 NLP | 4 | DeepSeek LLM、英文解析、智能摘要、语言同步 |
| 视图修复 | 3 | 事件多列布局、设置面板滚动、hydration 修复 |
| PWA / 性能 | 2 | 离线缓存、SW 清理 |
| 新功能 | 1 | 时间预算 |
| **合计** | **14** | |

---

> 全部测试：`pnpm test` 通过（144 个用例）。`main` 分支始终保持可运行状态。
