# CoreShift 多视图功能设计规格

## 概述

在现有月视图基础上新增年视图和日视图，以及视图间的点击导航和全局12/24小时制切换。

## 技术决策

- **视图状态管理**：React state 扩展（方案 A），不引入 URL 路由
- **视图切换方式**：点击驱动（年→月→日层层深入，← 返回逐层退出）
- **时间格式设置**：全局 `use24h` boolean，localStorage 持久化

---

## 新增 State（page.tsx）

```ts
type ViewMode = 'year' | 'month' | 'day';
const [view, setView] = useState<ViewMode>('month');
const [use24h, setUse24h] = useState<boolean>(() => {
  if (typeof window === 'undefined') return true;
  const saved = localStorage.getItem('use24h');
  return saved === null ? true : saved === 'true';
});
```

`use24h` 变更时同步写入 `localStorage('use24h')`。

---

## 新增组件

| 文件 | 职责 |
|------|------|
| `components/calendar/YearGrid.tsx` | 3×4 迷你月历网格，年视图主体 |
| `components/calendar/DayView.tsx` | 48格时间轴，日视图主体 |

---

## YearGrid 组件

**接口：**
```ts
interface YearGridProps {
  year: number;
  events: CalendarEvent[];
  onMonthClick: (date: Date) => void;
}
```

**布局：** 3列 × 4行网格，每格一个迷你月历卡片。

**每个迷你月历卡片：**
- 月份标题（「1月」～「12月」）
- 星期列头（日一二三四五六）
- 日期格子（复用 `getCalendarDays`）
- 今天蓝色圆圈高亮
- 有事件的日期显示彩色小圆点（使用 `toISODateString` + Map 索引）
- 悬停整卡片浅蓝背景，点击调用 `onMonthClick(new Date(year, monthIndex, 1))`

**数据获取：** 年视图加载时拉取全年事件：
```
start = new Date(year, 0, 1)
end   = new Date(year, 11, 31, 23, 59, 59)
```

---

## DayView 组件

**接口：**
```ts
interface DayViewProps {
  date: Date;
  events: CalendarEvent[];
  use24h: boolean;
}
```

**布局：** 左侧时间标签列（固定宽度）+ 右侧事件区，整体纵向滚动。

**时间轴规格：**
- 48 格，每格 30 分钟，格高 `h-12`（48px），总高 `48 × 48px = 2304px`
- 整点显示时间标签，半点不显示标签
- 12小时制格式：`上午 9:00`、`下午 3:30`
- 24小时制格式：`09:00`、`15:30`
- 当天显示当前时间红色横线（`top = (nowHour * 60 + nowMinute) / 30 * 48`px）

**事件定位：**
- `top = (startHour * 60 + startMinute) / 30 * 48`（px）
- `height = durationMinutes / 30 * 48`（px），无 `endAt` 默认 30 分钟
- 颜色复用 `colorFor(id)`（需将该函数从 `EventCard.tsx` 中导出，或移至 `lib/calendar/color-utils.ts` 共享工具），显示标题 + 格式化开始时间

**初始滚动：** `useEffect` 挂载时滚动到当天第一个事件位置；无事件滚到上午8点（`top = 8 * 2 * 48 = 768px`）。

**数据获取：**
```
start = 当天 00:00:00
end   = 当天 23:59:59
```

---

## 左侧边栏改动

新增元素（从上到下）：

1. **← 返回按钮**：非年视图时显示
   - 日视图 → 返回月视图
   - 月视图 → 返回年视图
2. **今天按钮**（现有，保留）
3. **迷你月历**（现有，保留）
4. **底部设置区**（新增）：
   - 「🕐 时间格式」标签
   - 「12小时 / 24小时」单选切换
5. **语音输入占位**（现有，保留）

---

## 顶部导航栏改动

`‹ ›` 按钮行为随视图变化：

| 视图 | ‹ / › 行为 | 标题格式 |
|------|-----------|---------|
| 年视图 | 前/后一年 | `2026年` |
| 月视图 | 前/后一月 | `2026年5月` |
| 日视图 | 前/后一天 | `2026年5月29日 周四` |

星期中文映射：`['周日','周一','周二','周三','周四','周五','周六']`

---

## 导航流程

```
年视图
  └─ 点击月份卡片 → 月视图（viewDate = 该月1日）
       └─ 点击日期格子 → 日视图（viewDate = 该天）
            └─ ← 返回 → 月视图
       └─ ← 返回 → 年视图
```

---

## 新增工具函数（date-utils.ts）

```ts
export function formatDayTitle(date: Date): string
// 返回：「2026年5月29日 周四」

export function formatTimeSlot(hour: number, minute: number, use24h: boolean): string
// 24h: '09:00' / 12h: '上午 9:00'
```

---

## 测试要求

| 测试文件 | 覆盖内容 |
|---------|---------|
| `__tests__/components/YearGrid.test.tsx` | 渲染12个月、有事件日期显示小圆点、点击月份触发回调 |
| `__tests__/components/DayView.test.tsx` | 渲染48格、事件定位正确、12/24h格式切换 |
| `__tests__/lib/date-utils.test.ts`（追加） | `formatDayTitle`、`formatTimeSlot` |

---

## 不在本次范围内

- 周视图
- 事件拖拽
- 跨天事件（`endAt` 跨越午夜）的特殊处理
- 事件点击编辑
