# 多视图功能实现计划（年视图 + 日视图 + 12/24h 切换）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有月视图基础上新增年视图（3×4迷你月历网格）和日视图（48格时间轴），支持点击层级导航（年→月→日），以及全局12/24小时制切换（localStorage持久化）。

**Architecture:** React state 扩展方案，在 `page.tsx` 新增 `view: 'year' | 'month' | 'day'` 和 `use24h: boolean` 两个状态，两个新组件 `YearGrid` 和 `DayView` 完全受控。`colorFor` 函数从 `EventCard.tsx` 提取到 `lib/calendar/color-utils.ts` 供两个视图共用。

**Tech Stack:** Next.js 14, TypeScript, React, Tailwind CSS, Jest, @testing-library/react

---

## 文件清单

| 路径 | 操作 | 职责 |
|------|------|------|
| `lib/calendar/color-utils.ts` | 创建 | `COLORS` 常量 + `colorFor(id)` 共享工具函数 |
| `components/events/EventCard.tsx` | 修改 | 改为从 color-utils 导入 |
| `lib/calendar/date-utils.ts` | 修改 | 新增 `formatDayTitle`、`formatTimeSlot` |
| `components/calendar/YearGrid.tsx` | 创建 | 3×4 迷你月历网格，年视图主体 |
| `components/calendar/DayView.tsx` | 创建 | 48格时间轴，日视图主体 |
| `app/page.tsx` | 修改 | 视图状态、导航逻辑、设置面板 |
| `__tests__/lib/color-utils.test.ts` | 创建 | colorFor 单元测试 |
| `__tests__/lib/date-utils.test.ts` | 修改 | 追加 formatDayTitle、formatTimeSlot 测试 |
| `__tests__/components/YearGrid.test.tsx` | 创建 | YearGrid 渲染与交互测试 |
| `__tests__/components/DayView.test.tsx` | 创建 | DayView 渲染、时间格式切换测试 |

---

## Task 1: 提取 colorFor 为共享工具（TDD）

**Files:**
- Create: `lib/calendar/color-utils.ts`
- Create: `__tests__/lib/color-utils.test.ts`
- Modify: `components/events/EventCard.tsx`

- [ ] **Step 1: 创建失败的测试**

```ts
// __tests__/lib/color-utils.test.ts
import { colorFor, EVENT_COLORS } from '@/lib/calendar/color-utils';

describe('colorFor', () => {
  it('returns a string from EVENT_COLORS', () => {
    expect(EVENT_COLORS).toContain(colorFor('test-id'));
  });

  it('returns the same color for the same id', () => {
    expect(colorFor('abc-123')).toBe(colorFor('abc-123'));
  });

  it('returns different colors for different ids (distribution check)', () => {
    const ids = ['id-1', 'id-2', 'id-3', 'id-4', 'id-5', 'id-6'];
    const colors = new Set(ids.map(colorFor));
    expect(colors.size).toBeGreaterThan(1);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
npm test -- __tests__/lib/color-utils.test.ts
```

Expected: `Cannot find module '@/lib/calendar/color-utils'`

- [ ] **Step 3: 创建 lib/calendar/color-utils.ts**

```ts
// lib/calendar/color-utils.ts
export const EVENT_COLORS = [
  'bg-blue-500', 'bg-green-600', 'bg-red-500',
  'bg-purple-500', 'bg-amber-500', 'bg-pink-500',
];

export function colorFor(id: string): string {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return EVENT_COLORS[h % EVENT_COLORS.length];
}
```

- [ ] **Step 4: 更新 components/events/EventCard.tsx（改为从 color-utils 导入）**

完整替换为：

```tsx
// components/events/EventCard.tsx
import { formatTimeCN } from '@/lib/calendar/date-utils';
import { colorFor } from '@/lib/calendar/color-utils';
import type { CalendarEvent } from '@/types';

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

- [ ] **Step 5: 运行全部测试确认无回归**

```bash
npm test
```

Expected: 所有测试通过（color-utils 3个新增测试 + 原有测试均 passed）

- [ ] **Step 6: 提交**

```bash
git add lib/calendar/color-utils.ts components/events/EventCard.tsx __tests__/lib/color-utils.test.ts
git commit -m "refactor: extract colorFor to shared color-utils"
```

---

## Task 2: date-utils 新增 formatDayTitle 和 formatTimeSlot（TDD）

**Files:**
- Modify: `__tests__/lib/date-utils.test.ts`（追加测试）
- Modify: `lib/calendar/date-utils.ts`（追加函数）

- [ ] **Step 1: 在 `__tests__/lib/date-utils.test.ts` 末尾追加测试**

```ts
describe('formatDayTitle', () => {
  it('formats date with weekday in Chinese', () => {
    // 2026-05-29 is a Thursday (周四)
    expect(formatDayTitle(new Date(2026, 4, 29))).toBe('2026年5月29日 周四');
  });

  it('formats Sunday correctly', () => {
    // 2026-05-25 is a Sunday (周日)
    expect(formatDayTitle(new Date(2026, 4, 25))).toBe('2026年5月25日 周日');
  });

  it('formats Monday correctly', () => {
    // 2026-05-26 is a Monday (周一)
    expect(formatDayTitle(new Date(2026, 4, 26))).toBe('2026年5月26日 周一');
  });
});

describe('formatTimeSlot', () => {
  it('formats 24h midnight', () => {
    expect(formatTimeSlot(0, 0, true)).toBe('00:00');
  });

  it('formats 24h afternoon', () => {
    expect(formatTimeSlot(15, 30, true)).toBe('15:30');
  });

  it('formats 24h pads single-digit hour', () => {
    expect(formatTimeSlot(9, 0, true)).toBe('09:00');
  });

  it('formats 12h morning', () => {
    expect(formatTimeSlot(9, 0, false)).toBe('上午 9:00');
  });

  it('formats 12h afternoon', () => {
    expect(formatTimeSlot(15, 30, false)).toBe('下午 3:30');
  });

  it('formats 12h noon as 下午 12:00', () => {
    expect(formatTimeSlot(12, 0, false)).toBe('下午 12:00');
  });

  it('formats 12h midnight as 上午 12:00', () => {
    expect(formatTimeSlot(0, 0, false)).toBe('上午 12:00');
  });
});
```

同时在文件顶部 import 行中加入 `formatDayTitle, formatTimeSlot`：

```ts
import {
  getCalendarDays,
  isSameDay,
  isToday,
  formatMonthYear,
  formatTimeCN,
  toISODateString,
  formatDayTitle,
  formatTimeSlot,
} from '@/lib/calendar/date-utils';
```

- [ ] **Step 2: 运行测试确认新增测试失败**

```bash
npm test -- __tests__/lib/date-utils.test.ts
```

Expected: `formatDayTitle is not a function` 或类似错误

- [ ] **Step 3: 在 lib/calendar/date-utils.ts 末尾追加两个函数**

```ts
const WEEK_DAYS_CN = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

export function formatDayTitle(date: Date): string {
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${WEEK_DAYS_CN[date.getDay()]}`;
}

export function formatTimeSlot(hour: number, minute: number, use24h: boolean): string {
  const mm = minute.toString().padStart(2, '0');
  if (use24h) {
    return `${hour.toString().padStart(2, '0')}:${mm}`;
  }
  const period = hour < 12 ? '上午' : '下午';
  const h = hour % 12 || 12;
  return `${period} ${h}:${mm}`;
}
```

- [ ] **Step 4: 运行测试确认全部通过**

```bash
npm test -- __tests__/lib/date-utils.test.ts
```

Expected: 全部通过（原有 13 个 + 新增 10 个 = 23 tests passed）

- [ ] **Step 5: 提交**

```bash
git add lib/calendar/date-utils.ts __tests__/lib/date-utils.test.ts
git commit -m "feat: add formatDayTitle and formatTimeSlot to date-utils"
```

---

## Task 3: YearGrid 组件（TDD）

**Files:**
- Create: `__tests__/components/YearGrid.test.tsx`
- Create: `components/calendar/YearGrid.tsx`

- [ ] **Step 1: 创建失败的测试**

```tsx
// __tests__/components/YearGrid.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { YearGrid } from '@/components/calendar/YearGrid';
import type { CalendarEvent } from '@/types';

const events: CalendarEvent[] = [
  {
    id: 'ev-1',
    title: '组会',
    startAt: new Date(2026, 4, 29, 15, 0).toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

describe('YearGrid', () => {
  it('renders 12 month cards', () => {
    render(<YearGrid year={2026} events={[]} onMonthClick={jest.fn()} />);
    ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月']
      .forEach(m => expect(screen.getByText(m)).toBeInTheDocument());
  });

  it('shows event dot for dates with events', () => {
    render(<YearGrid year={2026} events={events} onMonthClick={jest.fn()} />);
    expect(screen.getAllByTestId('event-dot').length).toBeGreaterThan(0);
  });

  it('does not show event dots when no events', () => {
    render(<YearGrid year={2026} events={[]} onMonthClick={jest.fn()} />);
    expect(screen.queryAllByTestId('event-dot').length).toBe(0);
  });

  it('calls onMonthClick with correct month and year when card is clicked', () => {
    const onMonthClick = jest.fn();
    render(<YearGrid year={2026} events={[]} onMonthClick={onMonthClick} />);
    fireEvent.click(screen.getByTestId('month-card-4')); // May = index 4
    expect(onMonthClick).toHaveBeenCalledTimes(1);
    const arg: Date = onMonthClick.mock.calls[0][0];
    expect(arg.getFullYear()).toBe(2026);
    expect(arg.getMonth()).toBe(4);
    expect(arg.getDate()).toBe(1);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
npm test -- __tests__/components/YearGrid.test.tsx
```

Expected: `Cannot find module '@/components/calendar/YearGrid'`

- [ ] **Step 3: 创建 components/calendar/YearGrid.tsx**

```tsx
// components/calendar/YearGrid.tsx
'use client';

import { useMemo } from 'react';
import {
  getCalendarDays,
  isToday,
  toISODateString,
} from '@/lib/calendar/date-utils';
import type { CalendarEvent } from '@/types';

const WEEK_DAYS = ['日', '一', '二', '三', '四', '五', '六'];
const MONTHS = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];

interface YearGridProps {
  year: number;
  events: CalendarEvent[];
  onMonthClick: (date: Date) => void;
}

export function YearGrid({ year, events, onMonthClick }: YearGridProps) {
  const eventDates = useMemo(() => {
    const set = new Set<string>();
    for (const e of events) set.add(toISODateString(new Date(e.startAt)));
    return set;
  }, [events]);

  return (
    <div className="grid grid-cols-3 gap-4 p-6 overflow-auto h-full">
      {Array.from({ length: 12 }, (_, monthIndex) => {
        const days = getCalendarDays(year, monthIndex);
        return (
          <div
            key={monthIndex}
            data-testid={`month-card-${monthIndex}`}
            onClick={() => onMonthClick(new Date(year, monthIndex, 1))}
            className="border border-gray-200 rounded-lg p-3 cursor-pointer hover:bg-blue-50 transition-colors select-none"
          >
            <div className="text-sm font-medium text-gray-700 mb-2">
              {MONTHS[monthIndex]}
            </div>
            <div className="grid grid-cols-7 mb-1">
              {WEEK_DAYS.map(d => (
                <div key={d} className="text-center text-xs text-gray-400">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-y-0.5">
              {days.map((day, i) => {
                const inMonth = day.getMonth() === monthIndex;
                const today = isToday(day);
                const hasEvent = inMonth && eventDates.has(toISODateString(day));
                return (
                  <div key={i} className="flex flex-col items-center">
                    <div className={[
                      'w-5 h-5 flex items-center justify-center text-xs rounded-full',
                      !inMonth && 'text-gray-300',
                      inMonth && !today && 'text-gray-700',
                      today && 'bg-blue-600 text-white font-bold',
                    ].filter(Boolean).join(' ')}>
                      {day.getDate()}
                    </div>
                    {hasEvent && (
                      <div
                        className="w-1 h-1 rounded-full bg-blue-400 mt-0.5"
                        data-testid="event-dot"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: 运行测试确认全部通过**

```bash
npm test -- __tests__/components/YearGrid.test.tsx
```

Expected: `Tests: 4 passed, 4 total`

- [ ] **Step 5: 提交**

```bash
git add components/calendar/YearGrid.tsx __tests__/components/YearGrid.test.tsx
git commit -m "feat: add YearGrid component with 3x4 month grid and event dots"
```

---

## Task 4: DayView 组件（TDD）

**Files:**
- Create: `__tests__/components/DayView.test.tsx`
- Create: `components/calendar/DayView.tsx`

- [ ] **Step 1: 创建失败的测试**

```tsx
// __tests__/components/DayView.test.tsx
import { render, screen, within } from '@testing-library/react';
import { DayView } from '@/components/calendar/DayView';
import type { CalendarEvent } from '@/types';

const MAY_29 = new Date(2026, 4, 29);

const events: CalendarEvent[] = [
  {
    id: 'ev-1',
    title: '组会',
    startAt: new Date(2026, 4, 29, 15, 0).toISOString(),
    endAt: new Date(2026, 4, 29, 16, 0).toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

describe('DayView', () => {
  it('renders 48 time slots', () => {
    render(<DayView date={MAY_29} events={[]} use24h={true} />);
    expect(screen.getAllByTestId('time-slot').length).toBe(48);
  });

  it('shows event title', () => {
    render(<DayView date={MAY_29} events={events} use24h={true} />);
    expect(screen.getByText('组会')).toBeInTheDocument();
  });

  it('shows event time in 24h format', () => {
    render(<DayView date={MAY_29} events={events} use24h={true} />);
    const block = screen.getByTestId('event-block-ev-1');
    expect(within(block).getByText('15:00')).toBeInTheDocument();
  });

  it('shows event time in 12h format', () => {
    render(<DayView date={MAY_29} events={events} use24h={false} />);
    const block = screen.getByTestId('event-block-ev-1');
    expect(within(block).getByText('下午 3:00')).toBeInTheDocument();
  });

  it('does not show events from other days', () => {
    const otherDayEvent: CalendarEvent = {
      id: 'ev-other',
      title: '其他天的事件',
      startAt: new Date(2026, 4, 30, 10, 0).toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    render(<DayView date={MAY_29} events={[otherDayEvent]} use24h={true} />);
    expect(screen.queryByText('其他天的事件')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
npm test -- __tests__/components/DayView.test.tsx
```

Expected: `Cannot find module '@/components/calendar/DayView'`

- [ ] **Step 3: 创建 components/calendar/DayView.tsx**

```tsx
// components/calendar/DayView.tsx
'use client';

import { useRef, useEffect } from 'react';
import { isToday, toISODateString, formatTimeSlot } from '@/lib/calendar/date-utils';
import { colorFor } from '@/lib/calendar/color-utils';
import type { CalendarEvent } from '@/types';

const SLOT_HEIGHT = 48; // px per 30-min slot

interface DayViewProps {
  date: Date;
  events: CalendarEvent[];
  use24h: boolean;
}

export function DayView({ date, events, use24h }: DayViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const dateKey = toISODateString(date);
  const dayEvents = events.filter(
    e => toISODateString(new Date(e.startAt)) === dateKey
  );

  const now = new Date();
  const showNowLine = isToday(date);
  const nowTop = (now.getHours() * 60 + now.getMinutes()) / 30 * SLOT_HEIGHT;

  useEffect(() => {
    if (!scrollRef.current) return;
    let scrollTop: number;
    if (dayEvents.length > 0) {
      const first = dayEvents.reduce((a, b) =>
        new Date(a.startAt) < new Date(b.startAt) ? a : b
      );
      const d = new Date(first.startAt);
      scrollTop = (d.getHours() * 60 + d.getMinutes()) / 30 * SLOT_HEIGHT - SLOT_HEIGHT * 2;
    } else {
      scrollTop = 8 * 2 * SLOT_HEIGHT; // scroll to 08:00
    }
    scrollRef.current.scrollTop = Math.max(0, scrollTop);
  }, [date]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto">
      <div className="relative" style={{ height: `${48 * SLOT_HEIGHT}px` }}>
        {/* Time slots */}
        {Array.from({ length: 48 }, (_, i) => {
          const hour = Math.floor(i / 2);
          const minute = i % 2 === 0 ? 0 : 30;
          return (
            <div
              key={i}
              data-testid="time-slot"
              className="absolute w-full flex border-b border-gray-100"
              style={{ top: `${i * SLOT_HEIGHT}px`, height: `${SLOT_HEIGHT}px` }}
            >
              <div className="w-16 flex-shrink-0 flex items-start justify-end pr-3 pt-1">
                {minute === 0 && (
                  <span className="text-xs text-gray-400">
                    {formatTimeSlot(hour, 0, use24h)}
                  </span>
                )}
              </div>
              <div className="flex-1 border-l border-gray-200" />
            </div>
          );
        })}

        {/* Current time line */}
        {showNowLine && (
          <div
            className="absolute left-16 right-0 z-10 pointer-events-none"
            style={{ top: `${nowTop}px` }}
            data-testid="now-line"
          >
            <div className="relative border-t-2 border-red-500">
              <div className="absolute -left-1.5 -top-1.5 w-3 h-3 rounded-full bg-red-500" />
            </div>
          </div>
        )}

        {/* Event blocks */}
        {dayEvents.map(event => {
          const start = new Date(event.startAt);
          const end = event.endAt
            ? new Date(event.endAt)
            : new Date(start.getTime() + 30 * 60 * 1000);
          const topPx = (start.getHours() * 60 + start.getMinutes()) / 30 * SLOT_HEIGHT;
          const durationMin = (end.getTime() - start.getTime()) / 60000;
          const heightPx = Math.max(durationMin / 30 * SLOT_HEIGHT, SLOT_HEIGHT * 0.5);

          return (
            <div
              key={event.id}
              data-testid={`event-block-${event.id}`}
              className={`absolute left-16 right-2 rounded-md px-2 py-1 ${colorFor(event.id)} text-white overflow-hidden`}
              style={{ top: `${topPx}px`, height: `${heightPx}px` }}
            >
              <div className="text-xs font-medium truncate">{event.title}</div>
              <div className="text-xs opacity-80">
                {formatTimeSlot(start.getHours(), start.getMinutes(), use24h)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: 运行测试确认全部通过**

```bash
npm test -- __tests__/components/DayView.test.tsx
```

Expected: `Tests: 5 passed, 5 total`

- [ ] **Step 5: 运行全部测试确认无回归**

```bash
npm test
```

Expected: 全部套件通过

- [ ] **Step 6: 提交**

```bash
git add components/calendar/DayView.tsx __tests__/components/DayView.test.tsx
git commit -m "feat: add DayView component with 48-slot timeline and 12/24h support"
```

---

## Task 5: page.tsx 扩展视图状态、导航逻辑与设置面板

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: 完整替换 app/page.tsx**

```tsx
// app/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { MiniCalendar } from '@/components/calendar/MiniCalendar';
import { MonthGrid } from '@/components/calendar/MonthGrid';
import { YearGrid } from '@/components/calendar/YearGrid';
import { DayView } from '@/components/calendar/DayView';
import { formatMonthYear, formatDayTitle } from '@/lib/calendar/date-utils';
import type { CalendarEvent } from '@/types';

type ViewMode = 'year' | 'month' | 'day';

export default function CalendarPage() {
  const [view, setView] = useState<ViewMode>('month');
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [viewDate, setViewDate] = useState(() => new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [use24h, setUse24h] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const saved = localStorage.getItem('use24h');
    return saved === null ? true : saved === 'true';
  });

  const fetchEvents = useCallback(async (date: Date, currentView: ViewMode) => {
    setLoading(true);
    try {
      let start: Date, end: Date;
      if (currentView === 'year') {
        start = new Date(date.getFullYear(), 0, 1);
        end = new Date(date.getFullYear(), 11, 31, 23, 59, 59);
      } else if (currentView === 'month') {
        start = new Date(date.getFullYear(), date.getMonth(), 1);
        end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59);
      } else {
        start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0);
        end = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59);
      }
      const res = await fetch(
        `/api/events?start=${start.toISOString()}&end=${end.toISOString()}`
      );
      if (res.ok) setEvents(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents(viewDate, view);
  }, [viewDate, view, fetchEvents]);

  function handleUse24hChange(value: boolean) {
    setUse24h(value);
    localStorage.setItem('use24h', String(value));
  }

  function goBack() {
    if (view === 'day') setView('month');
    else if (view === 'month') setView('year');
  }

  function goToToday() {
    const today = new Date();
    setSelectedDate(today);
    setViewDate(today);
    setView('day');
  }

  function goPrev() {
    if (view === 'year')
      setViewDate(d => new Date(d.getFullYear() - 1, d.getMonth(), 1));
    else if (view === 'month')
      setViewDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1));
    else
      setViewDate(d => new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1));
  }

  function goNext() {
    if (view === 'year')
      setViewDate(d => new Date(d.getFullYear() + 1, d.getMonth(), 1));
    else if (view === 'month')
      setViewDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1));
    else
      setViewDate(d => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1));
  }

  function handleMonthClick(date: Date) {
    setViewDate(date);
    setView('month');
  }

  function handleDayClick(date: Date) {
    setSelectedDate(date);
    setViewDate(date);
    setView('day');
  }

  function getNavTitle(): string {
    if (view === 'year') return `${viewDate.getFullYear()}年`;
    if (view === 'month') return formatMonthYear(viewDate);
    return formatDayTitle(viewDate);
  }

  const prevLabel = view === 'year' ? '上一年' : view === 'month' ? '上个月' : '前一天';
  const nextLabel = view === 'year' ? '下一年' : view === 'month' ? '下个月' : '后一天';

  return (
    <div className="flex h-screen bg-white font-sans">
      {/* Left Sidebar */}
      <aside className="w-64 border-r border-gray-200 flex flex-col p-4 gap-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🗓</span>
          <span className="text-lg font-medium text-gray-700">CoreShift</span>
        </div>

        {view !== 'year' && (
          <button
            onClick={goBack}
            className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1 w-fit"
          >
            ← 返回
          </button>
        )}

        <button
          onClick={goToToday}
          className="text-sm border border-gray-300 rounded-full px-4 py-1.5 hover:bg-gray-50 text-gray-600 w-fit transition-colors"
        >
          今天
        </button>

        <MiniCalendar
          selectedDate={selectedDate}
          onDateSelect={date => {
            setSelectedDate(date);
            setViewDate(date);
            setView('day');
          }}
        />

        <div className="mt-auto flex flex-col gap-3">
          {/* Time format toggle */}
          <div className="border border-gray-200 rounded-lg p-3">
            <div className="text-xs text-gray-500 mb-2">🕐 时间格式</div>
            <div className="flex gap-2">
              <button
                onClick={() => handleUse24hChange(false)}
                className={`flex-1 text-xs py-1 rounded transition-colors ${
                  !use24h
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                12小时
              </button>
              <button
                onClick={() => handleUse24hChange(true)}
                className={`flex-1 text-xs py-1 rounded transition-colors ${
                  use24h
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                24小时
              </button>
            </div>
          </div>

          <div className="border border-dashed border-gray-300 rounded-lg p-3 text-center text-xs text-gray-400">
            🎙 语音输入（即将上线）
          </div>
        </div>
      </aside>

      {/* Main Area */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-200 flex-shrink-0">
          <button
            onClick={goPrev}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500"
            aria-label={prevLabel}
          >
            ‹
          </button>
          <button
            onClick={goNext}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500"
            aria-label={nextLabel}
          >
            ›
          </button>
          <h2 className="text-base font-normal text-gray-700 ml-1">
            {getNavTitle()}
          </h2>
          {loading && (
            <span className="ml-auto text-xs text-gray-400 animate-pulse">加载中…</span>
          )}
        </div>

        {view === 'year' && (
          <YearGrid
            year={viewDate.getFullYear()}
            events={events}
            onMonthClick={handleMonthClick}
          />
        )}
        {view === 'month' && (
          <MonthGrid
            viewDate={viewDate}
            events={events}
            onDateClick={handleDayClick}
          />
        )}
        {view === 'day' && (
          <DayView date={viewDate} events={events} use24h={use24h} />
        )}
      </main>
    </div>
  );
}
```

- [ ] **Step 2: TypeScript 检查**

```bash
npx tsc --noEmit
```

Expected: 无报错

- [ ] **Step 3: 运行全部测试确认无回归**

```bash
npm test
```

Expected: 所有套件通过

- [ ] **Step 4: 启动 dev server 手动验证**

```bash
npm run dev
```

在浏览器 `http://localhost:3000` 验证：
- 默认显示月视图，今天有蓝色高亮
- 点击某个日期格子 → 进入日视图，显示48格时间轴
- 日视图左侧「← 返回」→ 回到月视图
- 月视图点「← 返回」→ 进入年视图，看到3×4迷你月历
- 年视图点某月 → 进入该月的月视图
- 左下角时间格式切换「12小时」↔「24小时」，日视图时间标签随之变化
- 刷新后时间格式设置保留

- [ ] **Step 5: 提交**

```bash
git add app/page.tsx
git commit -m "feat: add year/day views with click navigation and 12/24h toggle"
```

---

## 验收标准

- [ ] `npm test` 全部通过（含新增 color-utils、date-utils、YearGrid、DayView 测试）
- [ ] 年视图：3×4 迷你月历，有事件的日期显示彩色小圆点
- [ ] 月视图：点击日期进入日视图
- [ ] 日视图：48格时间轴，事件块按时间定位
- [ ] 12/24小时切换按钮在左侧边栏，刷新后保留设置
- [ ] ← 返回按钮逐层退出，年视图不显示
- [ ] 顶部 ‹ › 按钮在各视图分别切换年/月/天
