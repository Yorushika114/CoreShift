'use client';

import { useState, useEffect, useRef } from 'react';

interface YearPickerPopupProps {
  currentYear: number;
  onSelect: (year: number) => void;
  onClose: () => void;
}

export function YearPickerPopup({ currentYear, onSelect, onClose }: YearPickerPopupProps) {
  const [rangeStart, setRangeStart] = useState(() => currentYear - 5);
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

  const years = Array.from({ length: 12 }, (_, i) => rangeStart + i);

  return (
    <div
      ref={ref}
      className="absolute top-full left-0 mt-1 z-50 bg-white border border-gray-200 rounded-xl shadow-xl p-3 w-52"
    >
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={() => setRangeStart(s => s - 12)}
          className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500 text-lg"
        >
          ‹
        </button>
        <span className="text-xs text-gray-400">{rangeStart} – {rangeStart + 11}</span>
        <button
          onClick={() => setRangeStart(s => s + 12)}
          className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500 text-lg"
        >
          ›
        </button>
      </div>

      <div className="grid grid-cols-3 gap-1">
        {years.map(year => (
          <button
            key={year}
            onClick={() => { onSelect(year); onClose(); }}
            className={`py-2 rounded-lg text-sm font-medium transition-colors ${
              year === currentYear
                ? 'bg-blue-600 text-white'
                : 'text-gray-700 hover:bg-blue-50 hover:text-blue-600'
            }`}
          >
            {year}
          </button>
        ))}
      </div>
    </div>
  );
}
