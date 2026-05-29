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
        <div className="flex items-center gap-2">
          <span className="text-2xl">🗓</span>
          <span className="text-lg font-medium text-gray-700">CoreShift</span>
        </div>

        <button
          onClick={goToToday}
          className="text-sm border border-gray-300 rounded-full px-4 py-1.5 hover:bg-gray-50 text-gray-600 w-fit transition-colors"
        >
          今天
        </button>

        <MiniCalendar selectedDate={selectedDate} onDateSelect={handleDateSelect} />

        <div className="mt-auto">
          <div className="border border-dashed border-gray-300 rounded-lg p-3 text-center text-xs text-gray-400">
            🎙 语音输入（即将上线）
          </div>
        </div>
      </aside>

      {/* Main Area */}
      <main className="flex-1 flex flex-col overflow-hidden">
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

        <MonthGrid
          viewDate={viewDate}
          events={events}
          onDateClick={handleDateSelect}
        />
      </main>
    </div>
  );
}
