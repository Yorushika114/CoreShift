# CoreShift 语音日历工具 — 设计规格

## 项目概述

以语音为核心入口的日历管理工具。用户通过自然语音完成日程的增删改查和提醒管理，UI 参照 Google Calendar 风格。

## 技术决策

| 维度 | 选型 |
|------|------|
| 框架 | Next.js 14 App Router + TypeScript |
| 样式 | Tailwind CSS |
| 数据库 | SQLite + Prisma |
| 语音转写 | 外部 API（适配器模式，支持 Whisper / 讯飞，环境变量切换） |
| NLP 解析 | LLM API（Claude + GPT-4o，环境变量切换） |
| LLM 响应 | Server-Sent Events 流式返回 |
| 持久化 | Prisma + SQLite（本地文件） |

## 架构：后端编排 + 流式返回

```
浏览器录音
  → POST /api/voice       # 音频 → 语音 API → 文字
  → POST /api/process     # 文字 → LLM 流式解析 → Prisma CRUD → 流式结果
  → GET  /api/events      # 刷新日历
```

## 数据模型

```ts
type CalendarEvent = {
  id: string;
  title: string;
  startAt: string;       // ISO 8601
  endAt?: string;
  reminderAt?: string;
  createdAt: string;
  updatedAt: string;
  sourceText?: string;   // 原始语音转写文本
};
```

## 项目结构

```
/app
  /api
    /voice/route.ts        # 语音转写
    /process/route.ts      # NLP 编排（流式 SSE）
    /events/route.ts       # GET 列表 / POST 创建
    /events/[id]/route.ts  # PUT 更新 / DELETE 删除
  page.tsx                 # 主日历页

/components
  /calendar                # 月视图网格、周视图、日期导航
  /voice                   # 麦克风按钮、状态指示、转写展示
  /events                  # 事件卡片、事件列表
  /dialogs                 # 删除确认、歧义澄清弹窗

/lib
  /voice                   # VoiceProvider 接口 + whisper/讯飞 适配器
  /nlp                     # LLM prompt 模板、结构化响应解析
  /calendar                # 日期工具、事件 CRUD 封装

/prisma
  schema.prisma

/types
  index.ts
```

## 可插拔接口

```ts
interface VoiceProvider {
  transcribe(audio: Blob): Promise<string>;
}
interface LLMProvider {
  parseIntent(text: string): AsyncIterable<string>;
}
// VOICE_PROVIDER=whisper|xunfei
// LLM_PROVIDER=claude|openai
```

## UI 设计（Google Calendar 风格）

- 左侧：迷你月历 + 日期导航
- 主区：月/周视图网格，事件块显示在对应日期
- 底部浮层：语音交互区（麦克风按钮 + 状态 + 转写 + 解析过程）

### 语音状态机

```
idle → listening → transcribing → parsing → confirming → done
                                          ↘ clarifying → confirming
```

每个状态对应不同 UI 反馈：监听中（波形动画）、转写中（spinner）、解析中（流式文字）、待确认（确认/取消按钮）、澄清（追问文字 + 输入框）。

## NLP 行为规范

LLM 返回结构化 JSON：

```json
{
  "intent": "create|delete|query|modify|unknown",
  "title": "组会",
  "startAt": "2026-05-30T15:00:00",
  "endAt": null,
  "reminderAt": "2026-05-30T14:45:00",
  "ambiguities": [],
  "clarificationNeeded": false,
  "clarificationQuestion": ""
}
```

歧义时 `clarificationNeeded: true`，前端展示 `clarificationQuestion`，用户补充后重新发起解析。

## 必要的 MVP 流程

1. 创建事件（含提醒）
2. 查询事件（今天/明天/本周/指定日期）
3. 删除事件（二次确认）
4. 歧义追问与恢复

## 实现里程碑（建议顺序）

1. **脚手架**：Next.js 初始化、Prisma schema、基础目录结构
2. **日历 UI**：Google Calendar 风格月视图，事件展示
3. **事件 CRUD API**：REST 接口 + Prisma 操作
4. **语音输入 UI**：麦克风按钮、状态机、转写展示
5. **NLP 流程**：LLM 解析 + 流式返回 + 歧义处理
6. **完整语音流程**：端到端 voice → action → calendar 更新
7. **提醒功能**：Browser Notification API
8. **README + Demo 打磨**

## 已知限制

- 语音 API 供应商待定，初期可用文本框模拟语音输入
- LLM 解析依赖网络和 API Key，离线不可用
- 时间表达覆盖常见中文表达，极端歧义表达可能需人工兜底
