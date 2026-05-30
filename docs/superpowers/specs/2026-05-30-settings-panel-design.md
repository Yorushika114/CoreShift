# Settings Panel Design

**Date:** 2026-05-30
**Feature:** 统一设置面板（侧边栏折叠）

---

## 概述

将现有散落在侧边栏底部的时间格式切换、Google 日历同步迁移到一个统一的可折叠设置面板中，并新增语言切换（中/英）、时区切换（IANA）、自定义背景图片（URL + 文件上传）五项设置。

---

## 数据模型

```ts
type Settings = {
  use24h: boolean        // 时间制式，默认 true（24h）
  language: 'zh' | 'en' // 界面语言，默认 'zh'
  timezone: string       // IANA 时区，默认浏览器时区
  bgType: 'none' | 'url' | 'file'  // 背景类型
  bgValue: string        // URL 字符串 或 base64 data URL，bgType=none 时为 ''
}
```

所有字段持久化到 `localStorage`，key 前缀 `cs_`（如 `cs_use24h`、`cs_language`）。默认时区通过 `Intl.DateTimeFormat().resolvedOptions().timeZone` 获取。

---

## 架构

### 新增文件

| 文件 | 职责 |
|------|------|
| `contexts/SettingsContext.tsx` | Context + Provider + `useSettings()` hook；读写 localStorage；暴露 `t(key)` i18n 函数 |
| `lib/i18n.ts` | 中英文标签对照表，`zh` / `en` 两个对象，key 为语义名称 |
| `components/settings/SettingsPanel.tsx` | 可折叠设置面板；包含所有设置项 UI；由侧边栏底部渲染 |

### 修改文件

| 文件 | 改动 |
|------|------|
| `app/page.tsx` | 用 `<SettingsProvider>` 包裹，移除内联时间格式切换和 Google 控件，改从 context 读取 |
| `lib/calendar/date-utils.ts` | `formatTimeCN` / `formatDateCN` 增加可选 `timezone?: string` 参数，内部用 `Intl.DateTimeFormat` |
| `components/calendar/DayView.tsx` | 从 `useSettings()` 读取 `timezone`、`use24h`；`nowTop` 按所选时区计算 |
| `components/calendar/WeekView.tsx` | 同上 |

---

## UI 布局

侧边栏底部，MiniCalendar 下方：

```
⚙ 设置                    ▶   ← 默认折叠，点击展开/收起
─────────────────────────────
（展开后）
  🕐 时间格式    [12小时] [24小时]
  🌍 时区        [下拉选择 ~15个常用 IANA]
  🌐 语言        [中文]   [EN]
  🖼 背景图片    [___URL输入框___] [上传]
─────────────────────────────
  🗓 Google 日历
     ● 已连接 / [连接 Google 日历]
     [同步 Google 日历]  [同步状态文字]
```

时区下拉列表（固定约15项）：
- Asia/Shanghai（UTC+8）
- Asia/Tokyo（UTC+9）
- Asia/Seoul（UTC+9）
- Asia/Singapore（UTC+8）
- Asia/Kolkata（UTC+5:30）
- Europe/London（UTC+0/+1）
- Europe/Paris（UTC+1/+2）
- Europe/Berlin（UTC+1/+2）
- America/New_York（UTC-5/-4）
- America/Chicago（UTC-6/-5）
- America/Denver（UTC-7/-6）
- America/Los_Angeles（UTC-8/-7）
- America/Sao_Paulo（UTC-3）
- Africa/Cairo（UTC+2）
- UTC

---

## i18n

`lib/i18n.ts` 导出两个对象，`useSettings()` 封装 `t(key)` 函数：

```ts
export const labels = {
  zh: {
    settings: '设置',
    timeFormat: '时间格式',
    h12: '12小时',
    h24: '24小时',
    timezone: '时区',
    language: '语言',
    background: '背景图片',
    bgUrlPlaceholder: '输入图片 URL',
    bgUpload: '上传图片',
    googleConnected: 'Google 日历已连接',
    googleConnect: '连接 Google 日历',
    googleSync: '同步 Google 日历',
    syncing: '同步中…',
    // ... 其余标签
  },
  en: {
    settings: 'Settings',
    timeFormat: 'Time Format',
    h12: '12h',
    h24: '24h',
    timezone: 'Timezone',
    language: 'Language',
    background: 'Background',
    bgUrlPlaceholder: 'Enter image URL',
    bgUpload: 'Upload',
    googleConnected: 'Google Calendar connected',
    googleConnect: 'Connect Google Calendar',
    googleSync: 'Sync Google Calendar',
    syncing: 'Syncing…',
    // ... 其余标签
  },
}
```

`t(key)` 找不到 key 时返回 key 本身，不崩溃。

---

## 背景图片

- **URL 方式**：输入框失焦后立即生效，值存 `cs_bgValue`，`cs_bgType='url'`
- **文件上传**：`<input type="file" accept="image/*">`，FileReader 转 base64；文件 > 2MB 时提示错误，不存储
- **应用位置**：主内容区 `<main>` 的 wrapper div 加 `style={{ backgroundImage, backgroundSize: 'cover', backgroundPosition: 'center' }}`；侧边栏不受影响
- **清除**：设置 `bgType='none'` 即可，不额外提供删除按钮（重新上传或清空 URL 即视为清除）

---

## 时区实现

`date-utils.ts` 中所有格式化函数签名增加可选 `timezone` 参数：

```ts
function formatTimeCN(date: Date, use24h = true, timezone?: string): string
function formatDateCN(date: Date, timezone?: string): string
```

内部改用：
```ts
new Intl.DateTimeFormat('zh-CN', { timeZone: timezone ?? undefined, hour: '2-digit', ... })
```

DayView / WeekView 的"当前时间线"按所选时区重新计算当前小时/分钟：
```ts
const now = new Date()
const tzNow = new Date(now.toLocaleString('en-US', { timeZone: timezone }))
const nowTop = (tzNow.getHours() * 60 + tzNow.getMinutes()) / 30 * SLOT_HEIGHT
```

---

## 边界处理

| 场景 | 处理 |
|------|------|
| base64 图片 > 2MB | `file.size > 2 * 1024 * 1024` 时阻止，显示错误提示 |
| localStorage 写入失败 | try/catch，失败时提示"图片太大，请使用 URL 方式" |
| 背景 URL 图片加载失败 | 用隐藏 `<img>` 预检测，`onerror` 时清除背景，不崩溃 |
| 时区无效 | `Intl.DateTimeFormat` 构造失败时 catch，fallback 到浏览器时区 |
| i18n key 缺失 | `labels[lang][key] ?? key` |
| 首次加载无 localStorage | 所有字段使用 defaults（`use24h=true`，`language='zh'`，`timezone=浏览器时区`，`bgType='none'`）|

---

## 不在范围内

- NLP 解析、语音识别语言不随语言设置切换（仍为中文）
- TTS 播报语言不切换
- 时区不影响事件存储格式（仍为 UTC ISO）
- 重复事件、提醒逻辑不变
