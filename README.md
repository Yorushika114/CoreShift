# CoreShift · 语音日历工具

> 七牛云实训营 · 题目一「语音版的日历工具」

## 快速评审入口

- **线上体验**：[https://coreshift-production.up.railway.app](https://coreshift-production.up.railway.app)
- **Demo 视频**：[Bilibili 公开链接](https://www.bilibili.com/video/BV1hTVS6ZExi/?vd_source=b8dbf88e9fe34c0aab3902f31ad42a6e)
- **视频链接说明**：[`docs/demo/demo-link.md`](docs/demo/demo-link.md)

建议使用 Chrome / Edge 体验语音识别；Safari / Firefox 会自动降级为文字输入。

## 项目概述

CoreShift 是一个以语音为核心入口的 Web/PWA 日历管理工具。用户可以通过自然语言语音指令（或文字兜底输入）完成日程的**创建、查询、删除、修改和提醒管理**，无需手动填写表单。

系统会实时展示"听到了什么 → 解析出了什么 → 准备执行什么"的完整过程，并在操作存在歧义或风险时主动追问确认，不静默猜测。

---

## 核心功能

| 功能 | 说明 |
| --- | --- |
| **语音创建事件** | 说出自然语言，自动解析标题、日期、时间、持续时长、提醒偏移量 |
| **语音查询事件** | 询问"今天/明天/本周有什么安排"，语音播报结果并在日历高亮 |
| **语音删除事件** | 说出删除指令 → 精确/模糊匹配候选 → 二次确认 → 执行删除 |
| **语音修改事件** | 说出"改到/推迟到"等指令，解析目标事件和新时间后预览确认 |
| **提醒通知** | 解析"提前 X 分钟"，到时触发浏览器 Notification；SSE 实时同步 |
| **中文时间解析** | 支持"明天下午三点"、"下周一九点到十点"、"三天后"等常见表达 |
| **追问澄清** | 标题或时间不完整时主动追问，歧义匹配时展示候选项 |
| **过程透明** | 浮层实时展示转写文本、解析意图、提取字段与歧义警告 |
| **日历视图** | 年 / 月 / 周 / 日四种视图，点击时间格预填创建面板 |
| **重复事件** | 支持每日 / 每周重复事件，可单条或批量修改/删除 |
| **颜色标签** | 8 种事件颜色，快速区分不同类型日程 |
| **时区支持** | 设置中可选 IANA 时区，事件位置与标签跟随时区显示 |
| **Google 日历同步** | OAuth 2.0 授权，支持多 Google 日历双向同步与颜色区分 |
| **ICS 导入 / 导出** | 导入 `.ics` 文件（含重复规则），导出全部日历数据 |
| **AI 智能摘要** | 接入 DeepSeek LLM，增强解析并生成日程摘要（需 API Key） |
| **时间预算** | 按关键词自动分类事件，追踪每周各类活动时长与目标进度 |
| **国际化** | 中文 / 英文界面切换，12/24 小时格式，随时区动态调整 |
| **PWA 离线支持** | Service Worker 缓存，断网后仍可查看已缓存日历 |

---

## 技术栈与依赖

### 运行时依赖

| 依赖 | 版本 | 用途 |
| --- | --- | --- |
| `next` | ^14.2 | App Router，SSR / SSE / API Routes |
| `react` / `react-dom` | ^18.3 | UI 框架 |
| `tailwindcss` | ^3.4 | 样式 |
| `prisma` | ^7.8 | ORM |
| `@prisma/adapter-better-sqlite3` | ^7.8 | Prisma SQLite 驱动 |
| `better-sqlite3` | ^12.10 | 同步 SQLite（边车数据库，零配置） |
| `rrule` | ^2.8 | ICS 重复规则解析 |
| `dotenv` | ^17 | 读取 `.env.local` 环境变量 |

### 开发依赖

| 依赖 | 用途 |
| --- | --- |
| `jest` + `jest-environment-jsdom` | 单元测试 |
| `@testing-library/react` | 组件测试 |
| `typescript` | 类型检查 |
| `eslint-config-next` | 代码规范 |

### 外部服务

| 服务 | 说明 | 是否必须 |
| --- | --- | --- |
| **Web Speech API**（浏览器内置） | 语音识别（STT） | 需要 Chrome / Edge |
| **Fish Audio TTS API** | 语音播报（TTS），有网时使用 | 否（有离线降级） |
| **window.speechSynthesis**（浏览器内置） | TTS 离线降级 / Fish Audio 不可用时兜底 | — |
| **Notification API**（浏览器内置） | 提醒弹窗通知 | 需要用户授权 |
| **DeepSeek API** | LLM 增强解析与日程摘要 | 否（降级为正则解析） |
| **Google Calendar API** | Google 日历双向同步 | 否（可选功能） |

---

## 语音识别与 TTS 说明

- **语音识别**：使用真实浏览器 Web Speech API（`SpeechRecognition`），需要 Chrome 或 Edge，需要麦克风权限。Safari / Firefox 不支持，会自动隐藏麦克风按钮，降级为纯文字输入。
- **TTS 语音播报**：
  - **在线**：调用 Fish Audio 外部 TTS API（需配置 `FISH_AUDIO_API_KEY`），音质接近真人。
  - **离线 / API 不可用**：自动降级为 `window.speechSynthesis`（浏览器内置，无需网络）。

---

## 原创实现部分

以下模块均为本项目自主实现，未使用第三方 NLP SDK；语音时间解析、意图识别、事件匹配、修改执行和提醒调度均为项目内原创实现：

- **`lib/voice/parseChineseTime.ts`** — 中文日期时间解析器，支持绝对时间（"下周三下午两点"）、相对偏移（"三小时后"）和提醒偏移提取（"提前30分钟"），含完整单测。
- **`lib/voice/parseVoiceCommand.ts`** — 意图识别（创建 / 查询 / 删除 / 修改）+ 字段提取 + 歧义检测；结束时间使用正则回顾断言提取，避免误判"改到/推迟到"。
- **`lib/voice/matchEvents.ts`** — 三级事件匹配（精确日期标题 → Dice 相似度模糊 → 全量候选），用于删除 / 修改时定位目标事件。
- **`lib/voice/applyModify.ts`** — 修改指令执行，支持改时间、改标题等字段更新。
- **`lib/reminder/reminderService.ts`** — 客户端提醒调度器，通过 SSE 实时推送触发 Notification API。
- **`lib/sse/eventBus.ts`** — 轻量 SSE 事件总线，无需 WebSocket。

---

## 线上体验

**部署地址**：[https://coreshift-production.up.railway.app](https://coreshift-production.up.railway.app)

---

## 连接 Google 日历

CoreShift 支持将日程同步到 Google 日历。点击右上角「连接 Google 日历」按钮即可开始授权流程。

### ⚠️ 授权时出现「此应用未经 Google 验证」警告

由于本项目处于开发测试阶段，尚未提交 Google OAuth 应用审核，授权页面会显示如下警告：

> **此应用未经 Google 验证**
> 此应用请求访问您 Google 账号中的敏感信息。在开发者通过 Google 验证之前，请勿使用该应用。

**这是正常现象，可以安全绕过：**

1. 在警告页面点击左下角 **「高级」**
2. 点击出现的 **「继续访问 coreshift-production.up.railway.app（不安全）」**
3. 正常完成 Google 账号授权即可

授权完成后，CoreShift 创建的日程会自动同步至你的 Google 日历。

---

## 安装与运行

### 前置要求

- Node.js ≥ 18
- Chrome 或 Edge（语音识别依赖 Web Speech API）
- 包管理器以 **npm** 为准（`package-lock.json` 为主要锁文件；`pnpm-workspace.yaml` 用于部署环境兼容）

### 步骤

```bash
# 1. 克隆仓库
git clone https://github.com/Yorushika114/CoreShift.git
cd CoreShift

# 2. 安装依赖
npm install

# 3. 初始化数据库
npx prisma db push

# 4. （可选）配置环境变量，不配置功能可正常运行，仅 TTS 音质和 AI 摘要受影响
# 在项目根目录创建 .env.local：
# FISH_AUDIO_API_KEY=你的 Fish Audio 密钥
# FISH_AUDIO_VOICE_ID=你的音色ID
# DEEPSEEK_API_KEY=你的 DeepSeek 密钥
# GOOGLE_CLIENT_ID=你的 Google OAuth Client ID
# GOOGLE_CLIENT_SECRET=你的 Google OAuth Client Secret

# 5. 启动开发服务器
npm run dev
# 访问 http://localhost:3001
```

生产构建不依赖 Google Fonts 等外部字体下载，国内网络或离线评审环境也可以直接执行：

```bash
npm run build
```

### 数据库管理（可选）

```bash
npx prisma studio   # 可视化查看数据
npx prisma db push  # 重置表结构（会清空数据）
npm run db:seed     # 写入演示数据，便于快速体验查询、修改、删除和时间预算
```

---

## 演示用法示例

以下指令均可通过点击麦克风按钮语音输入，或直接在文本框中文字输入：

```
# 创建事件
明天下午三点提醒我开组会
下周一上午九点到十点安排算法课
后天晚上八点复习，提前30分钟提醒

# 查询事件
我今天有什么安排
明天下午有什么安排
本周有哪些日程

# 删除事件
删除明天三点的组会
取消下周一的算法课

# 修改事件
把明天下午三点的组会改到四点
把今晚八点的复习推迟到九点
```

**完整操作流程：**

1. 点击右下角麦克风按钮（或直接点击语音助手浮层）
2. 说出自然语言指令
3. 界面展示转写文本 → 解析意图 → 提取字段
4. 如有歧义，系统追问澄清（如"明天几点？"）
5. 危险操作（删除）需二次确认
6. 确认后执行，日历视图实时更新

---

## 已知限制

- 语音识别依赖 Web Speech API，**仅支持 Chrome / Edge**，Safari、Firefox 无法使用语音输入（文字输入不受影响）。
- 中文时间解析支持常见口语表达，对极罕见的复合嵌套时间表达（如"下下下个月第三个周二"）可能解析失败，此时会提示追问。
- Fish Audio TTS 需要网络连接和有效 API Key，离线环境自动降级为浏览器内置 TTS（音质有所下降）。
- Notification 提醒需要用户在浏览器授权通知权限，且标签页需处于打开状态。
- 重复事件目前支持每日 / 每周，暂不支持自定义重复规则（如"每月第一个周一"）。
- AI 摘要与增强解析依赖 DeepSeek API，未配置时自动降级为本地正则解析。

---

## 测试

```bash
npm test              # 运行全部单测
npm run test:watch    # 监听模式
```

### 测试覆盖模块

| 测试文件 | 覆盖内容 |
| --- | --- |
| `parseChineseTime.test.ts` | 中文时间解析（绝对 / 相对 / 时段词 / 提醒偏移） |
| `parseVoiceCommand.test.ts` | 意图识别、字段提取、歧义检测 |
| `matchEvents.test.ts` | 三级事件匹配（精确 / 模糊 / 全量）与时间范围过滤 |
| `applyModify.test.ts` | 修改指令字段更新逻辑 |
| `date-utils.test.ts` | 日期格式化工具函数 |
| `color-utils.test.ts` | 事件颜色映射 |

---

## Demo 视频

**公开视频**：[https://www.bilibili.com/video/BV1hTVS6ZExi/](https://www.bilibili.com/video/BV1hTVS6ZExi/?vd_source=b8dbf88e9fe34c0aab3902f31ad42a6e)

**演示覆盖路径：**

1. 语音 / 文字输入创建日程，并展示解析过程。
2. 查询今天、明天、本周安排，日历视图同步跳转。
3. 修改日程时间，确认后回到对应视图。
4. 删除日程前展示候选项和二次确认。
5. 展示提醒通知、年 / 月 / 周 / 日视图切换。
6. 加分功能：Google 日历同步、ICS 导入导出、AI 摘要、时间预算。

核心创建、查询、修改、删除能力不依赖外部 API Key；DeepSeek、Fish Audio 和 Google Calendar 为可选增强功能。

---

## 项目结构

```
CoreShift/
├── app/                    # Next.js App Router
│   ├── api/events/         # CRUD + SSE 流
│   ├── api/tts/            # Fish Audio TTS 代理
│   ├── api/llm/            # DeepSeek 解析 / 摘要
│   ├── api/google/         # Google Calendar OAuth + 同步
│   └── page.tsx            # 主页面
├── components/
│   ├── calendar/           # 年 / 月 / 周 / 日视图
│   ├── events/             # 事件卡片
│   └── voice/              # 语音助手浮层、编辑面板、TTS
├── lib/
│   ├── calendar/           # 日期工具、颜色工具、事件 CRUD
│   ├── voice/              # NLP 解析、语音识别 Hook、TTS Hook
│   ├── reminder/           # 提醒定时服务
│   └── sse/                # SSE 事件总线
├── prisma/                 # Schema + 迁移
├── types/                  # 共享类型定义（CalendarEvent, ParsedCommand）
└── __tests__/              # 单元测试
```

---

## 开发团队

- **成员 A**：UI / 日历视图 / 事件展示 / PR 审核与 merge 整合
- **成员 B**：语音识别 / 中文 NLP 解析 / 存储 / 查询删除修改逻辑 / 测试
