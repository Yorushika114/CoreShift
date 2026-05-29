# CoreShift 脚手架 + 日历 UI 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 搭建 Next.js 14 项目骨架，实现 Google Calendar 风格月视图日历 UI，包含迷你月历、月视图网格、事件卡片，以及基础 Prisma + SQLite 事件 CRUD API。

**Architecture:** Next.js 14 App Router + TypeScript。主页为 Client Component，通过 `/api/events` REST API 读写事件。Prisma + SQLite 本地持久化。日历分左侧迷你月历导航栏和右侧主月视图网格两区域，参照 Google Calendar 风格。

**Tech Stack:** Next.js 14, TypeScript, Tailwind CSS, Prisma, SQLite (`better-sqlite3`), Jest, @testing-library/react

---

## 文件清单

| 路径 | 操作 | 职责 |
|------|------|------|
| `types/index.ts` | 创建 | CalendarEvent 类型定义 |
| `prisma/schema.prisma` | 创建 | Prisma 数据模型 |
| `prisma/seed.ts` | 创建 | 示例数据种子 |
| `.env` | 创建 | DATABASE_URL 配置 |
| `lib/prisma.ts` | 创建 | 全局 PrismaClient 单例 |
| `lib/calendar/date-utils.ts` | 创建 | 日期工具函数（纯函数） |
| `lib/calendar/events.ts` | 创建 | 事件 CRUD Prisma 封装 |
| `app/api/events/route.ts` | 创建 | GET 列表 / POST 创建 |
| `app/api/events/[id]/route.ts` | 创建 | PUT 更新 / DELETE 删除 |
| `components/events/EventCard.tsx` | 创建 | 事件卡片（紧凑+完整两种模式） |
| `components/calendar/MiniCalendar.tsx` | 创建 | 左侧迷你月历 |
| `components/calendar/MonthGrid.tsx` | 创建 | 右侧主月视图网格 |
| `app/page.tsx` | 修改 | 主页布局（双栏） |
| `app/globals.css` | 修改 | 全局样式（保留 Tailwind） |
| `jest.config.ts` | 创建 | Jest 配置 |
| `jest.setup.ts` | 创建 | Jest 环境初始化 |
| `__tests__/lib/date-utils.test.ts` | 创建 | 日期工具单元测试 |
| `__tests__/components/MiniCalendar.test.tsx` | 创建 | MiniCalendar 渲染测试 |
| `__tests__/components/MonthGrid.test.tsx` | 创建 | MonthGrid 渲染测试 |

---

## Task 1: 初始化 Next.js 项目

**Files:**
- Create: `package.json`（由 create-next-app 生成）
- Create: `next.config.ts`, `tsconfig.json`, `tailwind.config.ts`

- [ ] **Step 1: 在 CoreShift 目录运行 create-next-app**

```bash
cd C:\Users\23223\Desktop\CoreShift
npx create-next-app@latest . --typescript --tailwind --app --eslint --no-src-dir --import-alias "@/*"
```

遇到询问时全部选 Yes / 默认选项。完成后目录中会有 `package.json`、`app/`、`public/` 等。

- [ ] **Step 2: 安装 Prisma 和其他依赖**

```bash
npm install prisma @prisma/client
npm install -D tsx
npx prisma init --datasource-provider sqlite
```

- [ ] **Step 3: 安装 Jest 测试依赖**

```bash
npm install -D jest @testing-library/react @testing-library/jest-dom @testing-library/user-event jest-environment-jsdom @types/jest
```

- [ ] **Step 4: 确认 dev server 可以启动**

```bash
npm run dev
```

Expected: 终端出现 `▲ Next.js` 和 `Local: http://localhost:3000`，浏览器打开后显示 Next.js 默认页面。用 Ctrl+C 停止。

- [ ] **Step 5: 提交**

```bash
git init
git add -A
git commit -m "chore: initialize Next.js 14 project with Tailwind, Prisma, Jest"
```

---

## Task 2: 配置 Jest

**Files:**
- Create: `jest.config.ts`
- Create: `jest.setup.ts`
- Modify: `package.json`（添加 test 脚本）

- [ ] **Step 1: 创建 jest.config.ts**

```ts
// jest.config.ts
import type { Config } from 'jest';
import nextJest from 'next/jest.js';

const createJestConfig = nextJest({ dir: './' });

const config: Config = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/$1' },
};

export default createJestConfig(config);
```

- [ ] **Step 2: 创建 jest.setup.ts**

```ts
// jest.setup.ts
import '@testing-library/jest-dom';
```

- [ ] **Step 3: 在 package.json scripts 中添加 test 命令**

在 `package.json` 的 `"scripts"` 中添加：

```json
"test": "jest",
"test:watch": "jest --watch"
```

- [ ] **Step 4: 运行测试确认配置正确**

```bash
npm test -- --passWithNoTests
```

Expected: `No tests found, exiting with code 0` 或 `Test Suites: 0 passed`。

- [ ] **Step 5: 提交**

```bash
git add jest.config.ts jest.setup.ts package.json
git commit -m "chore: configure Jest with next/jest and React Testing Library"
```

---

## Task 3: TypeScript 类型定义

**Files:**
- Create: `types/index.ts`

- [ ] **Step 1: 创建 types/index.ts**

```ts
// types/index.ts
export type CalendarEvent = {
  id: string;
  title: string;
  startAt: string;       // ISO 8601
  endAt?: string | null;
  reminderAt?: string | null;
  createdAt: string;
  updatedAt: string;
  sourceText?: string | null;
};

export type Intent = 'create' | 'delete' | 'query' | 'modify' | 'unknown';

export type ParsedCommand = {
  intent: Intent;
  title?: string;
  startAt?: string;
  endAt?: string;
  reminderAt?: string;
  ambiguities: string[];
  clarificationNeeded: boolean;
  clarificationQuestion?: string;
};
```

- [ ] **Step 2: 提交**

```bash
git add types/index.ts
git commit -m "feat: add CalendarEvent and ParsedCommand TypeScript types"
```

---

## Task 4: Prisma schema + SQLite 初始化

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `.env`
- Create: `lib/prisma.ts`

- [ ] **Step 1: 更新 prisma/schema.prisma**

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model Event {
  id         String    @id @default(cuid())
  title      String
  startAt    DateTime
  endAt      DateTime?
  reminderAt DateTime?
  createdAt  DateTime  @default(now())
  updatedAt  DateTime  @updatedAt
  sourceText String?
}
```

- [ ] **Step 2: 确认 .env 包含 DATABASE_URL**

`prisma init` 已生成 `.env`，确认内容为：

```
DATABASE_URL="file:./dev.db"
```

若无则创建该文件，内容如上。

- [ ] **Step 3: 推送 schema 创建 SQLite 数据库**

```bash
npx prisma db push
```

Expected: `Your database is now in sync with your Prisma schema.`

- [ ] **Step 4: 创建 lib/prisma.ts（全局单例）**

```ts
// lib/prisma.ts
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient({ log: ['error'] });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
```

- [ ] **Step 5: 将 prisma/dev.db 加入 .gitignore**

在 `.gitignore` 末尾追加：

```
prisma/dev.db
prisma/dev.db-journal
.env
.superpowers/
```

- [ ] **Step 6: 提交**

```bash
git add prisma/schema.prisma lib/prisma.ts .gitignore
git commit -m "feat: add Prisma schema with Event model and SQLite setup"
```

---

## Task 5: 日期工具函数（TDD）

**Files:**
- Create: `__tests__/lib/date-utils.test.ts`
- Create: `lib/calendar/date-utils.ts`

- [ ] **Step 1: 创建失败的测试**

```ts
// __tests__/lib/date-utils.test.ts
import {
  getCalendarDays,
  isSameDay,
  isToday,
  formatMonthYear,
  formatTimeCN,
  toISODateString,
} from '@/lib/calendar/date-utils';

describe('getCalendarDays', () => {
  it('returns exactly 42 days', () => {
    expect(getCalendarDays(2026, 4).length).toBe(42);
  });

  it('first day is always Sunday (getDay() === 0)', () => {
    const days = getCalendarDays(2026, 4);
    expect(days[0].getDay()).toBe(0);
  });

  it('contains all 31 days of May 2026', () => {
    const days = getCalendarDays(2026, 4);
    const mayDays = days.filter(d => d.getMonth() === 4 && d.getFullYear() === 2026);
    expect(mayDays.length).toBe(31);
  });

  it('handles February in a leap year', () => {
    const days = getCalendarDays(2024, 1); // Feb 2024
    const febDays = days.filter(d => d.getMonth() === 1 && d.getFullYear() === 2024);
    expect(febDays.length).toBe(29);
  });
});

describe('isSameDay', () => {
  it('returns true for the same day', () => {
    expect(isSameDay(new Date(2026, 4, 29), new Date(2026, 4, 29))).toBe(true);
  });

  it('returns false for different days', () => {
    expect(isSameDay(new Date(2026, 4, 29), new Date(2026, 4, 30))).toBe(false);
  });

  it('ignores time component', () => {
    expect(
      isSameDay(new Date(2026, 4, 29, 0, 0), new Date(2026, 4, 29, 23, 59))
    ).toBe(true);
  });
});

describe('formatMonthYear', () => {
  it('formats month and year in Chinese', () => {
    expect(formatMonthYear(new Date(2026, 4, 1))).toBe('2026年5月');
  });

  it('handles January', () => {
    expect(formatMonthYear(new Date(2026, 0, 1))).toBe('2026年1月');
  });
});

describe('formatTimeCN', () => {
  it('formats morning time', () => {
    expect(formatTimeCN(new Date(2026, 4, 29, 9, 0))).toBe('上午9:00');
  });

  it('formats afternoon time', () => {
    expect(formatTimeCN(new Date(2026, 4, 29, 15, 30))).toBe('下午3:30');
  });

  it('formats noon as 下午12:00', () => {
    expect(formatTimeCN(new Date(2026, 4, 29, 12, 0))).toBe('下午12:00');
  });

  it('formats midnight as 上午12:00', () => {
    expect(formatTimeCN(new Date(2026, 4, 29, 0, 0))).toBe('上午12:00');
  });

  it('pads minutes with zero', () => {
    expect(formatTimeCN(new Date(2026, 4, 29, 9, 5))).toBe('上午9:05');
  });
});

describe('toISODateString', () => {
  it('returns YYYY-MM-DD using local time', () => {
    expect(toISODateString(new Date(2026, 4, 29))).toBe('2026-05-29');
  });

  it('pads month and day', () => {
    expect(toISODateString(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});
```

- [ ] **Step 2: 运行测试确认全部失败**

```bash
npm test -- __tests__/lib/date-utils.test.ts
```

Expected: `Cannot find module '@/lib/calendar/date-utils'`

- [ ] **Step 3: 创建 lib/calendar/date-utils.ts**

先创建目录：
```bash
mkdir -p lib/calendar
```

```ts
// lib/calendar/date-utils.ts

export function getCalendarDays(year: number, month: number): Date[] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const days: Date[] = [];

  // pad from previous month so grid starts on Sunday
  for (let i = firstDay.getDay() - 1; i >= 0; i--) {
    days.push(new Date(year, month, -i));
  }

  // current month
  for (let d = 1; d <= lastDay.getDate(); d++) {
    days.push(new Date(year, month, d));
  }

  // pad to exactly 42 (6 weeks × 7 days)
  while (days.length < 42) {
    const last = days[days.length - 1];
    days.push(new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1));
  }

  return days;
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function isToday(date: Date): boolean {
  return isSameDay(date, new Date());
}

export function formatMonthYear(date: Date): string {
  return `${date.getFullYear()}年${date.getMonth() + 1}月`;
}

export function formatDateCN(date: Date): string {
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

export function formatTimeCN(date: Date): string {
  const hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const period = hours < 12 ? '上午' : '下午';
  const h = hours % 12 || 12;
  return `${period}${h}:${minutes}`;
}

// Uses local time to avoid UTC-offset issues in China (UTC+8)
export function toISODateString(date: Date): string {
  const y = date.getFullYear();
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const d = date.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${d}`;
}
```

- [ ] **Step 4: 运行测试确认全部通过**

```bash
npm test -- __tests__/lib/date-utils.test.ts
```

Expected: `Tests: 13 passed, 13 total`

- [ ] **Step 5: 提交**

```bash
git add lib/calendar/date-utils.ts __tests__/lib/date-utils.test.ts
git commit -m "feat: add date utility functions with full test coverage"
```

---

## Task 6: 事件 CRUD 封装 + API 路由

**Files:**
- Create: `lib/calendar/events.ts`
- Create: `app/api/events/route.ts`
- Create: `app/api/events/[id]/route.ts`

- [ ] **Step 1: 创建 lib/calendar/events.ts**

```ts
// lib/calendar/events.ts
import { prisma } from '@/lib/prisma';
import type { CalendarEvent } from '@/types';

function toCalendarEvent(e: {
  id: string;
  title: string;
  startAt: Date;
  endAt: Date | null;
  reminderAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  sourceText: string | null;
}): CalendarEvent {
  return {
    id: e.id,
    title: e.title,
    startAt: e.startAt.toISOString(),
    endAt: e.endAt?.toISOString() ?? null,
    reminderAt: e.reminderAt?.toISOString() ?? null,
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
    sourceText: e.sourceText ?? null,
  };
}

export async function getEvents(startDate?: Date, endDate?: Date): Promise<CalendarEvent[]> {
  const events = await prisma.event.findMany({
    where: startDate || endDate
      ? { startAt: { gte: startDate, lte: endDate } }
      : undefined,
    orderBy: { startAt: 'asc' },
  });
  return events.map(toCalendarEvent);
}

export async function createEvent(
  data: Pick<CalendarEvent, 'title' | 'startAt'> &
    Partial<Pick<CalendarEvent, 'endAt' | 'reminderAt' | 'sourceText'>>
): Promise<CalendarEvent> {
  const event = await prisma.event.create({
    data: {
      title: data.title,
      startAt: new Date(data.startAt),
      endAt: data.endAt ? new Date(data.endAt) : null,
      reminderAt: data.reminderAt ? new Date(data.reminderAt) : null,
      sourceText: data.sourceText ?? null,
    },
  });
  return toCalendarEvent(event);
}

export async function updateEvent(
  id: string,
  data: Partial<Pick<CalendarEvent, 'title' | 'startAt' | 'endAt' | 'reminderAt' | 'sourceText'>>
): Promise<CalendarEvent> {
  const event = await prisma.event.update({
    where: { id },
    data: {
      ...(data.title !== undefined && { title: data.title }),
      ...(data.startAt !== undefined && { startAt: new Date(data.startAt) }),
      ...(data.endAt !== undefined && { endAt: data.endAt ? new Date(data.endAt) : null }),
      ...(data.reminderAt !== undefined && { reminderAt: data.reminderAt ? new Date(data.reminderAt) : null }),
      ...(data.sourceText !== undefined && { sourceText: data.sourceText }),
    },
  });
  return toCalendarEvent(event);
}

export async function deleteEvent(id: string): Promise<void> {
  await prisma.event.delete({ where: { id } });
}
```

- [ ] **Step 2: 创建 app/api/events/route.ts**

```ts
// app/api/events/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getEvents, createEvent } from '@/lib/calendar/events';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const start = searchParams.get('start');
  const end = searchParams.get('end');
  try {
    const events = await getEvents(
      start ? new Date(start) : undefined,
      end ? new Date(end) : undefined
    );
    return NextResponse.json(events);
  } catch (e) {
    return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.title || !body.startAt) {
      return NextResponse.json({ error: 'title and startAt are required' }, { status: 400 });
    }
    const event = await createEvent(body);
    return NextResponse.json(event, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: 'Failed to create event' }, { status: 500 });
  }
}
```

- [ ] **Step 3: 创建 app/api/events/[id]/route.ts**

```ts
// app/api/events/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { updateEvent, deleteEvent } from '@/lib/calendar/events';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const event = await updateEvent(params.id, body);
    return NextResponse.json(event);
  } catch (e) {
    return NextResponse.json({ error: 'Failed to update event' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await deleteEvent(params.id);
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    return NextResponse.json({ error: 'Failed to delete event' }, { status: 500 });
  }
}
```

- [ ] **Step 4: 手动验证 API（启动 dev server 后）**

```bash
npm run dev
```

在另一个终端：
```bash
# 创建事件
curl -X POST http://localhost:3000/api/events \
  -H "Content-Type: application/json" \
  -d "{\"title\":\"测试会议\",\"startAt\":\"2026-05-29T15:00:00\"}"

# 查询事件
curl http://localhost:3000/api/events
```

Expected: POST 返回带 id 的事件对象，GET 返回包含该事件的数组。

- [ ] **Step 5: 提交**

```bash
git add lib/calendar/events.ts app/api/events/
git commit -m "feat: add event CRUD helpers and REST API routes"
```

---

## Task 7: 种子数据

**Files:**
- Create: `prisma/seed.ts`
- Modify: `package.json`

- [ ] **Step 1: 创建 prisma/seed.ts**

```ts
// prisma/seed.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.event.deleteMany();

  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();

  await prisma.event.createMany({
    data: [
      {
        title: '算法课',
        startAt: new Date(y, m, d, 9, 0),
        endAt: new Date(y, m, d, 10, 0),
        sourceText: '今天上午九点到十点算法课',
      },
      {
        title: '组会',
        startAt: new Date(y, m, d, 15, 0),
        reminderAt: new Date(y, m, d, 14, 45),
        sourceText: '下午三点开组会',
      },
      {
        title: '复习',
        startAt: new Date(y, m, d + 2, 20, 0),
        reminderAt: new Date(y, m, d + 2, 19, 45),
      },
      {
        title: '项目答辩',
        startAt: new Date(y, m, d + 5, 14, 0),
        endAt: new Date(y, m, d + 5, 16, 0),
      },
      {
        title: '英语课',
        startAt: new Date(y, m, d - 1, 10, 0),
        endAt: new Date(y, m, d - 1, 11, 30),
      },
    ],
  });
  console.log('✓ Seed complete: 5 events created');
}

main().catch(console.error).finally(() => prisma.$disconnect());
```

- [ ] **Step 2: 在 package.json 中添加 seed 脚本和 prisma.seed 配置**

在 `scripts` 中添加：
```json
"db:seed": "npx tsx prisma/seed.ts",
"db:push": "prisma db push",
"db:studio": "prisma studio"
```

在 `package.json` 根级添加（与 `scripts` 同级）：
```json
"prisma": {
  "seed": "npx tsx prisma/seed.ts"
}
```

- [ ] **Step 3: 运行种子脚本**

```bash
npm run db:seed
```

Expected: `✓ Seed complete: 5 events created`

- [ ] **Step 4: 提交**

```bash
git add prisma/seed.ts package.json
git commit -m "chore: add database seed script with sample events"
```

---

## Task 8: EventCard 组件（TDD）

**Files:**
- Create: `__tests__/components/EventCard.test.tsx`
- Create: `components/events/EventCard.tsx`

- [ ] **Step 1: 创建失败的测试**

先创建目录：
```bash
mkdir -p __tests__/components components/events
```

```tsx
// __tests__/components/EventCard.test.tsx
import { render, screen } from '@testing-library/react';
import { EventCard } from '@/components/events/EventCard';
import type { CalendarEvent } from '@/types';

const event: CalendarEvent = {
  id: 'test-1',
  title: '组会',
  startAt: new Date(2026, 4, 29, 15, 0).toISOString(),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const eventWithReminder: CalendarEvent = {
  ...event,
  id: 'test-2',
  reminderAt: new Date(2026, 4, 29, 14, 45).toISOString(),
};

describe('EventCard', () => {
  it('renders event title', () => {
    render(<EventCard event={event} />);
    expect(screen.getByText('组会')).toBeInTheDocument();
  });

  it('renders time in Chinese format', () => {
    render(<EventCard event={event} />);
    expect(screen.getByText('下午3:00')).toBeInTheDocument();
  });

  it('shows reminder indicator when reminderAt is set', () => {
    render(<EventCard event={eventWithReminder} />);
    expect(screen.getByText(/提醒/)).toBeInTheDocument();
  });

  it('does not show reminder indicator when no reminderAt', () => {
    render(<EventCard event={event} />);
    expect(screen.queryByText(/提醒/)).not.toBeInTheDocument();
  });

  it('renders compact version with title and time', () => {
    render(<EventCard event={event} compact />);
    expect(screen.getByText(/组会/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
npm test -- __tests__/components/EventCard.test.tsx
```

Expected: `Cannot find module '@/components/events/EventCard'`

- [ ] **Step 3: 创建 components/events/EventCard.tsx**

```tsx
// components/events/EventCard.tsx
import { formatTimeCN } from '@/lib/calendar/date-utils';
import type { CalendarEvent } from '@/types';

const COLORS = [
  'bg-blue-500', 'bg-green-600', 'bg-red-500',
  'bg-purple-500', 'bg-amber-500', 'bg-pink-500',
];

function colorFor(id: string): string {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return COLORS[h % COLORS.length];
}

interface EventCardProps {
  event: CalendarEvent;
  compact?: boolean;
  onClick?: () => void;
}

export function EventCard({ event, compact = false, onClick }: EventCardProps) {
  const color = colorFor(event.id);
  const time = formatTimeCN(new Date(event.startAt));

  if (compact) {
    return (
      <div
        onClick={e => { e.stopPropagation(); onClick?.(); }}
        className={`${color} text-white text-xs rounded px-1 py-0.5 truncate cursor-pointer`}
        title={`${time} ${event.title}`}
      >
        {time} {event.title}
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className={`${color} text-white rounded-lg p-3 cursor-pointer hover:opacity-90 transition-opacity`}
    >
      <div className="font-medium text-sm">{event.title}</div>
      <div className="text-xs opacity-90 mt-0.5">{time}</div>
      {event.reminderAt && (
        <div className="text-xs opacity-75 mt-1">🔔 提醒已设置</div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
npm test -- __tests__/components/EventCard.test.tsx
```

Expected: `Tests: 5 passed, 5 total`

- [ ] **Step 5: 提交**

```bash
git add components/events/EventCard.tsx __tests__/components/EventCard.test.tsx
git commit -m "feat: add EventCard component with compact and full display modes"
```

---

## Task 9: MiniCalendar 组件（TDD）

**Files:**
- Create: `__tests__/components/MiniCalendar.test.tsx`
- Create: `components/calendar/MiniCalendar.tsx`

- [ ] **Step 1: 创建失败的测试**

```bash
mkdir -p components/calendar
```

```tsx
// __tests__/components/MiniCalendar.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { MiniCalendar } from '@/components/calendar/MiniCalendar';

const MAY_2026 = new Date(2026, 4, 15);

describe('MiniCalendar', () => {
  it('renders the current month and year', () => {
    render(<MiniCalendar selectedDate={MAY_2026} onDateSelect={jest.fn()} />);
    expect(screen.getByText('2026年5月')).toBeInTheDocument();
  });

  it('renders 7 weekday headers', () => {
    render(<MiniCalendar selectedDate={MAY_2026} onDateSelect={jest.fn()} />);
    ['日', '一', '二', '三', '四', '五', '六'].forEach(d => {
      expect(screen.getByText(d)).toBeInTheDocument();
    });
  });

  it('navigates to previous month', () => {
    render(<MiniCalendar selectedDate={MAY_2026} onDateSelect={jest.fn()} />);
    fireEvent.click(screen.getByLabelText('上个月'));
    expect(screen.getByText('2026年4月')).toBeInTheDocument();
  });

  it('navigates to next month', () => {
    render(<MiniCalendar selectedDate={MAY_2026} onDateSelect={jest.fn()} />);
    fireEvent.click(screen.getByLabelText('下个月'));
    expect(screen.getByText('2026年6月')).toBeInTheDocument();
  });

  it('calls onDateSelect when a day is clicked', () => {
    const onSelect = jest.fn();
    render(<MiniCalendar selectedDate={MAY_2026} onDateSelect={onSelect} />);
    const dayButtons = screen.getAllByRole('button');
    // find a button for day 10 in current month
    const day10 = dayButtons.find(b => b.textContent === '10');
    fireEvent.click(day10!);
    expect(onSelect).toHaveBeenCalled();
  });

  it('marks selected date visually (data-selected attribute)', () => {
    render(<MiniCalendar selectedDate={MAY_2026} onDateSelect={jest.fn()} />);
    const selected = screen.getAllByRole('button').find(
      b => b.getAttribute('data-selected') === 'true'
    );
    expect(selected).toBeDefined();
    expect(selected!.textContent).toBe('15');
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
npm test -- __tests__/components/MiniCalendar.test.tsx
```

Expected: `Cannot find module '@/components/calendar/MiniCalendar'`

- [ ] **Step 3: 创建 components/calendar/MiniCalendar.tsx**

```tsx
// components/calendar/MiniCalendar.tsx
'use client';

import { useState, useMemo } from 'react';
import {
  getCalendarDays,
  isSameDay,
  isToday,
  formatMonthYear,
} from '@/lib/calendar/date-utils';

const WEEK_DAYS = ['日', '一', '二', '三', '四', '五', '六'];

interface MiniCalendarProps {
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
}

export function MiniCalendar({ selectedDate, onDateSelect }: MiniCalendarProps) {
  const [viewDate, setViewDate] = useState(
    () => new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1)
  );

  const days = useMemo(
    () => getCalendarDays(viewDate.getFullYear(), viewDate.getMonth()),
    [viewDate]
  );

  function prevMonth() {
    setViewDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  }
  function nextMonth() {
    setViewDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  }

  return (
    <div className="w-full select-none">
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={prevMonth}
          aria-label="上个月"
          className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500 text-sm"
        >
          ‹
        </button>
        <span className="text-sm font-medium text-gray-700">
          {formatMonthYear(viewDate)}
        </span>
        <button
          onClick={nextMonth}
          aria-label="下个月"
          className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500 text-sm"
        >
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 mb-1">
        {WEEK_DAYS.map(d => (
          <div key={d} className="text-center text-xs text-gray-400 py-0.5">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-y-0.5">
        {days.map((day, i) => {
          const inMonth = day.getMonth() === viewDate.getMonth();
          const today = isToday(day);
          const selected = isSameDay(day, selectedDate);

          return (
            <button
              key={i}
              data-selected={selected ? 'true' : undefined}
              onClick={() => {
                onDateSelect(day);
                setViewDate(new Date(day.getFullYear(), day.getMonth(), 1));
              }}
              className={[
                'w-7 h-7 mx-auto text-xs rounded-full flex items-center justify-center transition-colors',
                !inMonth && 'text-gray-300 hover:bg-gray-100',
                inMonth && !today && !selected && 'text-gray-700 hover:bg-gray-100',
                today && !selected && 'text-blue-600 font-bold hover:bg-blue-50',
                selected && 'bg-blue-600 text-white font-bold hover:bg-blue-700',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {day.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
npm test -- __tests__/components/MiniCalendar.test.tsx
```

Expected: `Tests: 6 passed, 6 total`

- [ ] **Step 5: 提交**

```bash
git add components/calendar/MiniCalendar.tsx __tests__/components/MiniCalendar.test.tsx
git commit -m "feat: add MiniCalendar component with month navigation"
```

---

## Task 10: MonthGrid 组件（TDD）

**Files:**
- Create: `__tests__/components/MonthGrid.test.tsx`
- Create: `components/calendar/MonthGrid.tsx`

- [ ] **Step 1: 创建失败的测试**

```tsx
// __tests__/components/MonthGrid.test.tsx
import { render, screen } from '@testing-library/react';
import { MonthGrid } from '@/components/calendar/MonthGrid';
import type { CalendarEvent } from '@/types';

const MAY_2026 = new Date(2026, 4, 1);

const events: CalendarEvent[] = [
  {
    id: 'ev-1',
    title: '组会',
    startAt: new Date(2026, 4, 29, 15, 0).toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ev-2',
    title: '算法课',
    startAt: new Date(2026, 4, 29, 9, 0).toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

describe('MonthGrid', () => {
  it('renders month year header', () => {
    render(<MonthGrid viewDate={MAY_2026} events={[]} onDateClick={jest.fn()} />);
    expect(screen.getByText('2026年5月')).toBeInTheDocument();
  });

  it('renders all 7 weekday column headers', () => {
    render(<MonthGrid viewDate={MAY_2026} events={[]} onDateClick={jest.fn()} />);
    ['周日', '周一', '周二', '周三', '周四', '周五', '周六'].forEach(h => {
      expect(screen.getByText(h)).toBeInTheDocument();
    });
  });

  it('shows events on the correct date cell', () => {
    render(<MonthGrid viewDate={MAY_2026} events={events} onDateClick={jest.fn()} />);
    expect(screen.getByText(/组会/)).toBeInTheDocument();
    expect(screen.getByText(/算法课/)).toBeInTheDocument();
  });

  it('shows overflow label when more than 3 events on a day', () => {
    const manyEvents: CalendarEvent[] = Array.from({ length: 5 }, (_, i) => ({
      id: `ov-${i}`,
      title: `事件${i}`,
      startAt: new Date(2026, 4, 29, 9 + i, 0).toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));
    render(<MonthGrid viewDate={MAY_2026} events={manyEvents} onDateClick={jest.fn()} />);
    expect(screen.getByText('+2 更多')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
npm test -- __tests__/components/MonthGrid.test.tsx
```

Expected: `Cannot find module '@/components/calendar/MonthGrid'`

- [ ] **Step 3: 创建 components/calendar/MonthGrid.tsx**

```tsx
// components/calendar/MonthGrid.tsx
'use client';

import { useMemo } from 'react';
import {
  getCalendarDays,
  isToday,
  formatMonthYear,
  toISODateString,
} from '@/lib/calendar/date-utils';
import { EventCard } from '@/components/events/EventCard';
import type { CalendarEvent } from '@/types';

const WEEK_HEADERS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

interface MonthGridProps {
  viewDate: Date;
  events: CalendarEvent[];
  onDateClick: (date: Date) => void;
}

export function MonthGrid({ viewDate, events, onDateClick }: MonthGridProps) {
  const days = useMemo(
    () => getCalendarDays(viewDate.getFullYear(), viewDate.getMonth()),
    [viewDate]
  );

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of events) {
      const key = toISODateString(new Date(event.startAt));
      const list = map.get(key) ?? [];
      list.push(event);
      map.set(key, list);
    }
    return map;
  }, [events]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Month header */}
      <div className="flex items-center px-6 py-3 border-b border-gray-200 flex-shrink-0">
        <h1 className="text-xl font-normal text-gray-600">
          {formatMonthYear(viewDate)}
        </h1>
      </div>

      {/* Weekday column headers */}
      <div className="grid grid-cols-7 border-b border-gray-200 flex-shrink-0">
        {WEEK_HEADERS.map(h => (
          <div
            key={h}
            className="py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wide"
          >
            {h}
          </div>
        ))}
      </div>

      {/* Day cells grid */}
      <div className="grid grid-cols-7 flex-1 overflow-auto" style={{ gridAutoRows: 'minmax(80px, 1fr)' }}>
        {days.map((day, i) => {
          const inMonth = day.getMonth() === viewDate.getMonth();
          const today = isToday(day);
          const dateKey = toISODateString(day);
          const dayEvents = eventsByDate.get(dateKey) ?? [];

          return (
            <div
              key={i}
              onClick={() => onDateClick(day)}
              className={[
                'border-b border-r border-gray-200 p-1 cursor-pointer transition-colors',
                !inMonth ? 'bg-gray-50 hover:bg-gray-100' : 'bg-white hover:bg-blue-50',
              ].join(' ')}
            >
              {/* Date number */}
              <div
                className={[
                  'w-7 h-7 flex items-center justify-center text-sm mb-1 rounded-full mx-auto',
                  today
                    ? 'bg-blue-600 text-white font-bold'
                    : inMonth
                    ? 'text-gray-900'
                    : 'text-gray-400',
                ].join(' ')}
              >
                {day.getDate()}
              </div>

              {/* Events */}
              <div className="flex flex-col gap-0.5 overflow-hidden">
                {dayEvents.slice(0, 3).map(event => (
                  <EventCard key={event.id} event={event} compact />
                ))}
                {dayEvents.length > 3 && (
                  <span className="text-xs text-gray-500 pl-1">
                    +{dayEvents.length - 3} 更多
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
npm test -- __tests__/components/MonthGrid.test.tsx
```

Expected: `Tests: 4 passed, 4 total`

- [ ] **Step 5: 运行全部测试**

```bash
npm test
```

Expected: 所有测试套件全部 passed。

- [ ] **Step 6: 提交**

```bash
git add components/calendar/MonthGrid.tsx __tests__/components/MonthGrid.test.tsx
git commit -m "feat: add MonthGrid component with event display and overflow handling"
```

---

## Task 11: 主页布局组装

**Files:**
- Modify: `app/page.tsx`
- Modify: `app/globals.css`

- [ ] **Step 1: 更新 app/globals.css（保留 Tailwind，移除默认样式）**

```css
/* app/globals.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

html,
body {
  height: 100%;
  overflow: hidden;
}
```

- [ ] **Step 2: 更新 app/page.tsx**

```tsx
// app/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { MiniCalendar } from '@/components/calendar/MiniCalendar';
import { MonthGrid } from '@/components/calendar/MonthGrid';
import { formatMonthYear } from '@/lib/calendar/date-utils';
import type { CalendarEvent } from '@/types';

export default function CalendarPage() {
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [viewDate, setViewDate] = useState(() => new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEvents = useCallback(async (date: Date) => {
    setLoading(true);
    try {
      const start = new Date(date.getFullYear(), date.getMonth(), 1);
      const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59);
      const res = await fetch(
        `/api/events?start=${start.toISOString()}&end=${end.toISOString()}`
      );
      if (res.ok) setEvents(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents(viewDate);
  }, [viewDate, fetchEvents]);

  function handleDateSelect(date: Date) {
    setSelectedDate(date);
    setViewDate(new Date(date.getFullYear(), date.getMonth(), 1));
  }

  function goToPrevMonth() {
    setViewDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  }

  function goToNextMonth() {
    setViewDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  }

  function goToToday() {
    const today = new Date();
    setSelectedDate(today);
    setViewDate(new Date(today.getFullYear(), today.getMonth(), 1));
  }

  return (
    <div className="flex h-screen bg-white font-sans">
      {/* Left Sidebar */}
      <aside className="w-64 border-r border-gray-200 flex flex-col p-4 gap-4 flex-shrink-0">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <span className="text-2xl">🗓</span>
          <span className="text-lg font-medium text-gray-700">CoreShift</span>
        </div>

        {/* Today button */}
        <button
          onClick={goToToday}
          className="text-sm border border-gray-300 rounded-full px-4 py-1.5 hover:bg-gray-50 text-gray-600 w-fit transition-colors"
        >
          今天
        </button>

        {/* Mini calendar */}
        <MiniCalendar selectedDate={selectedDate} onDateSelect={handleDateSelect} />

        {/* Voice input placeholder */}
        <div className="mt-auto">
          <div className="border border-dashed border-gray-300 rounded-lg p-3 text-center text-xs text-gray-400">
            🎙 语音输入（即将上线）
          </div>
        </div>
      </aside>

      {/* Main Area */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top navigation bar */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-200 flex-shrink-0">
          <button
            onClick={goToPrevMonth}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500"
            aria-label="上个月"
          >
            ‹
          </button>
          <button
            onClick={goToNextMonth}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500"
            aria-label="下个月"
          >
            ›
          </button>
          <h2 className="text-base font-normal text-gray-700 ml-1">
            {formatMonthYear(viewDate)}
          </h2>
          {loading && (
            <span className="ml-auto text-xs text-gray-400 animate-pulse">加载中…</span>
          )}
        </div>

        {/* Calendar grid */}
        <MonthGrid
          viewDate={viewDate}
          events={events}
          onDateClick={handleDateSelect}
        />
      </main>
    </div>
  );
}
```

- [ ] **Step 3: 启动 dev server 并在浏览器验证**

```bash
npm run dev
```

在浏览器打开 `http://localhost:3000`，期望看到：
- 左侧栏：CoreShift Logo + 今天按钮 + 迷你月历 + 语音占位符
- 右侧：当前月份月视图网格，今天的格子有蓝色高亮
- 由种子数据生成的事件显示在对应日期格子中（有色小标签）
- 点击迷你月历的 ‹ › 切换月份，主视图同步更新
- 点击「今天」按钮回到当月

如果事件没显示，确认已运行 `npm run db:seed`。

- [ ] **Step 4: 运行全部测试确认无回归**

```bash
npm test
```

Expected: 所有测试通过。

- [ ] **Step 5: 提交**

```bash
git add app/page.tsx app/globals.css
git commit -m "feat: assemble main calendar page with Google Calendar-style layout"
```

---

## 验收标准

完成本计划后应满足：

- [ ] `npm run dev` 启动成功，`http://localhost:3000` 显示日历界面
- [ ] 左侧迷你月历可以点击日期、切换月份
- [ ] 右侧月视图网格正确显示 6 周 × 7 列
- [ ] 今天的格子有蓝色圆圈高亮
- [ ] 种子事件在对应格子显示为彩色标签
- [ ] 超出 3 个事件的格子显示「+N 更多」
- [ ] 点击「今天」按钮返回当月
- [ ] `npm test` 所有测试通过

---

## 自查：规格覆盖情况

| 规格要求 | 覆盖任务 |
|---------|---------|
| Next.js 14 App Router + TypeScript | Task 1 |
| Tailwind CSS | Task 1 |
| Prisma + SQLite | Task 4 |
| CalendarEvent 数据模型 | Task 3, 4 |
| Google Calendar 风格月视图 | Task 10, 11 |
| 迷你月历 | Task 9 |
| 事件卡片 | Task 8 |
| GET/POST/PUT/DELETE API routes | Task 6 |
| 日期工具函数（含中文格式化） | Task 5 |
| 示例数据 | Task 7 |
| 全测试覆盖（纯函数 + 组件） | Task 5, 8, 9, 10 |
