'use client';

import { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import {
  getCalendarDays,
  isToday,
  toISODateString,
} from '@/lib/calendar/date-utils';
import type { CalendarEvent } from '@/types';

const WEEK_DAYS = ['日', '一', '二', '三', '四', '五', '六'];
const MONTHS = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];

// 三面板的 translateY 百分比（相对于 wrapper 自身高度 300%）
// -33.33% × 3H = -H → 显示第二面板（当前年）
const SHOW_PREV   =    0;
const SHOW_CENTER = -100 / 3;   // ≈ -33.33%
const SHOW_NEXT   = -200 / 3;   // ≈ -66.67%

interface YearGridProps {
  year: number;
  events: CalendarEvent[];
  onMonthClick: (date: Date) => void;
  onNextYear?: () => void;
  onPrevYear?: () => void;
}

interface PanelProps {
  year: number;
  eventDates: Set<string>;
  isCenter: boolean;
  onMonthClick: (date: Date) => void;
  onReachBottom?: () => void;
  onReachTop?: () => void;
}

function YearPanel({ year, eventDates, isCenter, onMonthClick, onReachBottom, onReachTop }: PanelProps) {
  const ref = useRef<HTMLDivElement>(null);

  // 成为中心面板时滚回顶部，避免残留上次的滚动位置
  useEffect(() => {
    if (isCenter && ref.current) ref.current.scrollTop = 0;
  }, [isCenter]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    function handleWheel(e: WheelEvent) {
      if (!isCenter) return;
      const atBottom = el!.scrollTop + el!.clientHeight >= el!.scrollHeight - 4;
      const atTop    = el!.scrollTop === 0;
      if      (e.deltaY > 0 && atBottom) onReachBottom?.();
      else if (e.deltaY < 0 && atTop)    onReachTop?.();
    }
    el.addEventListener('wheel', handleWheel, { passive: true });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [isCenter, onReachBottom, onReachTop]);

  return (
    <div ref={ref} style={{ height: 'calc(100% / 3)', overflowY: 'auto' }}>
      <div className="grid grid-cols-3 gap-4 p-6">
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
                  const inMonth  = day.getMonth() === monthIndex;
                  const today    = isToday(day);
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
    </div>
  );
}

export function YearGrid({ year, events, onMonthClick, onNextYear, onPrevYear }: YearGridProps) {
  const [centerYear, setCenterYear] = useState(year);
  const [translateY,  setTranslateY]  = useState(SHOW_CENTER);
  const [isAnimating, setIsAnimating] = useState(false);

  const animating       = useRef(false);
  const centerYearRef   = useRef(centerYear);
  const externalYearRef = useRef(year);

  // 每次渲染同步 ref，让 setTimeout 内始终能读到最新值
  centerYearRef.current = centerYear;

  // 外部 year prop 变化（头部按钮切换年份）：无动画直接跳
  useEffect(() => {
    if (year !== externalYearRef.current && !animating.current) {
      externalYearRef.current = year;
      setCenterYear(year);
      setTranslateY(SHOW_CENTER);
    }
  }, [year]);

  const eventDates = useMemo(() => {
    const set = new Set<string>();
    for (const e of events) set.add(toISODateString(new Date(e.startAt)));
    return set;
  }, [events]);

  const slideToNext = useCallback(() => {
    if (animating.current) return;
    animating.current = true;
    setIsAnimating(true);
    setTranslateY(SHOW_NEXT);          // 开始向上滑

    setTimeout(() => {
      const newYear = centerYearRef.current + 1;
      externalYearRef.current = newYear;
      // 关掉 transition → 瞬间复位 → 用户看不到跳变（视觉内容完全一致）
      setIsAnimating(false);
      setCenterYear(newYear);
      setTranslateY(SHOW_CENTER);
      onNextYear?.();
      setTimeout(() => { animating.current = false; }, 60);
    }, 360);
  }, [onNextYear]);

  const slideToPrev = useCallback(() => {
    if (animating.current) return;
    animating.current = true;
    setIsAnimating(true);
    setTranslateY(SHOW_PREV);          // 开始向下滑

    setTimeout(() => {
      const newYear = centerYearRef.current - 1;
      externalYearRef.current = newYear;
      setIsAnimating(false);
      setCenterYear(newYear);
      setTranslateY(SHOW_CENTER);
      onPrevYear?.();
      setTimeout(() => { animating.current = false; }, 60);
    }, 360);
  }, [onPrevYear]);

  return (
    <div className="overflow-hidden h-full">
      <div
        style={{
          height: '300%',
          transform: `translateY(${translateY}%)`,
          transition: isAnimating
            ? 'transform 0.36s cubic-bezier(0.25, 0.46, 0.45, 0.94)'
            : 'none',
          willChange: 'transform',
        }}
      >
        {[centerYear - 1, centerYear, centerYear + 1].map((y, idx) => (
          <YearPanel
            key={y}
            year={y}
            eventDates={eventDates}
            isCenter={idx === 1}
            onMonthClick={onMonthClick}
            onReachBottom={idx === 1 ? slideToNext : undefined}
            onReachTop={idx === 1 ? slideToPrev : undefined}
          />
        ))}
      </div>
    </div>
  );
}
