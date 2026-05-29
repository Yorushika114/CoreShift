# CoreShift · 语音日历工具

> 七牛云实训营 · 题目一「语音版的日历工具」

## 项目概述

CoreShift 是一个以语音为核心入口的 Web/PWA 日历管理工具。用户可以通过自然语言语音指令（或文字兜底输入）完成日程的**创建、查询、删除、修改和提醒管理**，无需手动填写表单。

系统会实时展示"听到了什么 → 解析出了什么 → 准备执行什么"的完整过程，并在操作存在歧义或风险时主动追问确认，不静默猜测。

---

## 核心功能

| 功能         | 说明                                                           |
| ------------ | -------------------------------------------------------------- |
| 语音创建事件 | 说出自然语言，自动解析标题、日期、时间、持续时长、提醒         |
| 语音查询事件 | 询问"今天/明天/本周有什么安排"，语音播报结果                   |
| 语音删除事件 | 说出删除指令 → 匹配候选 → 二次确认 → 执行删除                  |
| 语音修改事件 | 说出"改到/推迟到"等指令，解析目标事件和新时间                  |
| 提醒通知     | 在事件提醒时间触发浏览器 Notification，SSE 实时同步            |
| 中文时间解析 | 支持"明天下午三点"、"下周一上午九点到十点"、"三天后"等常见表达 |
| 追问澄清     | 标题或时间不完整时主动追问，歧义匹配时展示候选项               |
| 日历视图     | 月视图 / 周视图 / 日视图，点击时间格直接预填创建面板           |
| 颜色标签     | 8 种事件颜色，快速区分不同类型日程                             |
| 重复事件     | 支持每日 / 每周重复事件                                        |

---

## 技术栈与依赖

### 运行时依赖

| 依赖                             | 版本   | 用途                              |
| -------------------------------- | ------ | --------------------------------- |
| `next`                           | ^14.2  | App Router，SSR/SSE/API Routes    |
| `react` / `react-dom`            | ^18.3  | UI 框架                           |
| `tailwindcss`                    | ^3.4   | 样式                              |
| `prisma`                         | ^7.8   | ORM                               |
| `@prisma/adapter-better-sqlite3` | ^7.8   | Prisma SQLite 驱动                |
| `better-sqlite3`                 | ^12.10 | 同步 SQLite（边车数据库，零配置） |
| `dotenv`                         | ^17    | 读取 `.env.local` 环境变量        |

### 开发依赖

| 依赖                              | 用途     |
| --------------------------------- | -------- |
| `jest` + `jest-environment-jsdom` | 单元测试 |
| `@testing-library/react`          | 组件测试 |
| `typescript`                      | 类型检查 |
| `eslint-config-next`              | 代码规范 |

### 外部服务

| 服务                                     | 说明                                   | 是否必须             |
| ---------------------------------------- | -------------------------------------- | -------------------- |
| **Web Speech API**（浏览器内置）         | 语音识别（STT）                        | 需要支持 Chrome/Edge |
| **Fish Audio TTS API**                   | 语音播报（TTS），有网时使用            | 否（有离线降级）     |
| **window.speechSynthesis**（浏览器内置） | TTS 离线降级 / Fish Audio 不可用时兜底 | —                    |
| **Notification API**（浏览器内置）       | 提醒弹窗通知                           | 需要用户授权         |

---

## 语音识别与 TTS 说明

- **语音识别**：使用真实浏览器 Web Speech API（`SpeechRecognition`），需要 Chrome 或 Edge，需要麦克风权限。Safari / Firefox 不支持，会自动隐藏麦克风按钮，降级为纯文字输入。
- **TTS 语音播报**：
  - **在线**：调用 Fish Audio 外部 TTS API（需配置 `FISH_AUDIO_API_KEY`），音质接近真人。
  - **离线 / API 不可用**：自动降级为 `window.speechSynthesis`（浏览器内置，无需网络）。

---

## 原创实现部分

以下模块均为本项目自主实现，未使用第三方 NLP SDK：

- **`lib/voice/parseChineseTime.ts`** — 中文日期时间解析器，支持绝对时间（"下周三下午两点"）和相对偏移（"三小时后"、"明天"），含完整单测。
- **`lib/voice/parseVoiceCommand.ts`** — 意图识别（创建/查询/删除/修改）+ 字段提取 + 歧义检测，结束时间使用正则回顾断言提取，避免误判"改到/推迟到"。
- **`lib/voice/matchEvents.ts`** — 按标题模糊匹配 + 时间范围过滤，用于删除/修改时定位目标事件。
- **`lib/voice/applyModify.ts`** — 修改指令执行，支持改时间、改标题等字段更新。
- **`lib/reminder/reminderService.ts`** — 服务端定时轮询提醒，通过 SSE 推送给客户端触发 Notification。
- **`lib/sse/eventBus.ts`** — 轻量 SSE 事件总线，无需 WebSocket。

---

## 安装与运行

### 前置要求

- Node.js ≥ 18
- Chrome 或 Edge（语音识别依赖 Web Speech API）

### 步骤

```bash
# 1. 克隆仓库
git clone https://github.com/Yorushika114/CoreShift.git
cd CoreShift

# 2. 安装依赖
npm install

# 3. 初始化数据库
npx prisma db push

# 4. （可选）配置 Fish Audio TTS，不配置会自动降级到浏览器 TTS
# 在项目根目录创建 .env.local：
# FISH_AUDIO_API_KEY=你的密钥
# FISH_AUDIO_VOICE_ID=你的音色ID

# 5. 启动开发服务器
npm run dev
# 访问 http://localhost:3001
```

### 数据库管理（可选）

```bash
npx prisma studio   # 可视化查看数据
npx prisma db push  # 重置表结构（会清空数据）
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
- 目前不支持跨时区事件（统一使用本地时区）。
- 重复事件目前支持每日 / 每周，暂不支持自定义重复规则（如"每月第一个周一"）。

---

## 测试

```bash
npm test              # 运行全部单测
npm run test:watch    # 监听模式
```

### 测试覆盖模块

| 测试文件                    | 覆盖内容                                    |
| --------------------------- | ------------------------------------------- |
| `parseChineseTime.test.ts`  | 中文时间解析（绝对 / 相对 / 时段词 / 跨天） |
| `parseVoiceCommand.test.ts` | 意图识别、字段提取、歧义检测                |
| `matchEvents.test.ts`       | 事件模糊匹配与时间范围过滤                  |
| `applyModify.test.ts`       | 修改指令字段更新逻辑                        |
| `date-utils.test.ts`        | 日期格式化工具函数                          |
| `color-utils.test.ts`       | 事件颜色映射                                |

---

## Demo 视频

> 待补充

---

## 项目结构

```
CoreShift/
├── app/                    # Next.js App Router
│   ├── api/events/         # CRUD + SSE 流
│   ├── api/tts/            # Fish Audio TTS 代理
│   └── page.tsx            # 主页面
├── components/
│   ├── calendar/           # 月 / 周 / 日视图
│   ├── events/             # 事件卡片
│   └── voice/              # 语音助手浮层、编辑面板、TTS
├── lib/
│   ├── calendar/           # 日期工具、颜色工具、事件 CRUD
│   ├── voice/              # NLP 解析、语音识别 Hook、TTS Hook
│   ├── reminder/           # 提醒定时服务
│   └── sse/                # SSE 事件总线
├── prisma/                 # Schema + 迁移
├── types/                  # 共享类型定义 (CalendarEvent, ParsedCommand)
└── __tests__/              # 单元测试
```

---

## 开发团队

- **成员 A**：UI / 日历视图 / 事件展示 / PR审核和merge整合
- **成员 B**：语音识别 / 中文 NLP 解析 / 存储 / 查询删除修改逻辑 / 测试
