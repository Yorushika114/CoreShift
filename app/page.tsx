// app/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { MiniCalendar } from '@/components/calendar/MiniCalendar';
import { MonthGrid } from '@/components/calendar/MonthGrid';
import { YearGrid } from '@/components/calendar/YearGrid';
import { DayView } from '@/components/calendar/DayView';
import { AddEventModal } from '@/components/voice/AddEventModal';
import { formatMonthYear, formatDayTitle } from '@/lib/calendar/date-utils';
import type { CalendarEvent } from '@/types';

type ViewMode = 'year' | 'month' | 'day';

export default function CalendarPage() {
  const [view, setView] = useState<ViewMode>('month');
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [viewDate, setViewDate] = useState(() => new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
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

  function handleEventSaved(eventDate: Date) {
    setShowAddModal(false);
    setSelectedDate(eventDate);
    setViewDate(new Date(eventDate.getFullYear(), eventDate.getMonth(), 1));
    fetchEvents(new Date(eventDate.getFullYear(), eventDate.getMonth(), 1), 'month');
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

        <div className="flex items-center gap-2">
          <button
            onClick={goToToday}
            className="text-sm border border-gray-300 rounded-full px-4 py-1.5 hover:bg-gray-50 text-gray-600 transition-colors"
          >
            今天
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-white bg-blue-500 hover:bg-blue-600 rounded-full transition shadow-sm"
          >
            <span className="text-base leading-none">+</span>
            新建
          </button>
        </div>

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

      {showAddModal && (
        <AddEventModal
          defaultDate={selectedDate}
          onClose={() => setShowAddModal(false)}
          onSaved={handleEventSaved}
        />
      )}
    </div>
  );
}
