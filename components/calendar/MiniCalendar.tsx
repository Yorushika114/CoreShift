// components/calendar/MiniCalendar.tsx
'use client';

import { useState, useMemo } from 'react';
import {
  getCalendarDays,
  isSameDay,
  isToday,
  formatMonthYear,
} from '@/lib/calendar/date-utils';
import { useSettings } from '@/contexts/SettingsContext';
import { WEEK_HEADERS_MINI } from '@/lib/i18n';

interface MiniCalendarProps {
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
}

export function MiniCalendar({ selectedDate, onDateSelect }: MiniCalendarProps) {
  const { t, language } = useSettings();
  const weekDaysMini = WEEK_HEADERS_MINI[language];
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
          aria-label={t('prevMonth')}
          className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500 text-sm"
        >
          ‹
        </button>
        <span className="text-sm font-medium text-gray-700">
          {formatMonthYear(viewDate)}
        </span>
        <button
          onClick={nextMonth}
          aria-label={t('nextMonth')}
          className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500 text-sm"
        >
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 mb-1">
        {weekDaysMini.map((d, i) => (
          <div key={i} className="text-center text-xs text-gray-400 py-0.5">
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
