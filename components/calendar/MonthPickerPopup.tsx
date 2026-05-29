'use client';

import { useState, useEffect, useRef } from 'react';

const MONTHS = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];

interface MonthPickerPopupProps {
  currentYear: number;
  currentMonth: number; // 0-indexed
  onSelect: (year: number, month: number) => void;
  onClose: () => void;
}

export function MonthPickerPopup({ currentYear, currentMonth, onSelect, onClose }: MonthPickerPopupProps) {
  const [year, setYear] = useState(currentYear);
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
      className="absolute top-full left-0 mt-1 z-50 bg-white border border-gray-200 rounded-xl shadow-xl p-3 w-52"
    >
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={() => setYear(y => y - 1)}
          className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500 text-lg"
        >
          ‹
        </button>
        <span className="text-sm font-medium text-gray-700">{year}年</span>
        <button
          onClick={() => setYear(y => y + 1)}
          className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500 text-lg"
        >
          ›
        </button>
      </div>

      <div className="grid grid-cols-3 gap-1">
        {MONTHS.map((label, i) => (
          <button
            key={i}
            onClick={() => { onSelect(year, i); onClose(); }}
            className={`py-2 rounded-lg text-sm font-medium transition-colors ${
              year === currentYear && i === currentMonth
                ? 'bg-blue-600 text-white'
                : 'text-gray-700 hover:bg-blue-50 hover:text-blue-600'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
