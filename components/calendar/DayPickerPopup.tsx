'use client';

import { useEffect, useRef } from 'react';
import { MiniCalendar } from './MiniCalendar';

interface DayPickerPopupProps {
  currentDate: Date;
  onSelect: (date: Date) => void;
  onClose: () => void;
}

export function DayPickerPopup({ currentDate, onSelect, onClose }: DayPickerPopupProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', handleDown);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleDown);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute top-full left-0 mt-1 z-50 bg-white border border-gray-200 rounded-xl shadow-xl p-2"
    >
      <MiniCalendar
        selectedDate={currentDate}
        onDateSelect={date => { onSelect(date); onClose(); }}
      />
    </div>
  );
}
