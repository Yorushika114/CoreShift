// components/events/EventCard.tsx
'use client';

import { formatTimeCN } from '@/lib/calendar/date-utils';
import { colorFor } from '@/lib/calendar/color-utils';
import { useSettings } from '@/contexts/SettingsContext';
import type { CalendarEvent } from '@/types';

interface EventCardProps {
  event: CalendarEvent;
  compact?: boolean;
  onClick?: () => void;
}

export function EventCard({ event, compact = false, onClick }: EventCardProps) {
  const { t } = useSettings();
  const color = colorFor(event);
  const time = formatTimeCN(new Date(event.startAt));
  const label = event.allDay
    ? event.title
    : `${time} ${event.title}`;

  if (compact) {
    return (
      <div
        onClick={e => { e.stopPropagation(); onClick?.(); }}
        className={`${color} text-white text-xs rounded-md px-1.5 py-0.5 truncate cursor-pointer flex items-center gap-0.5 shadow-sm`}
        title={label}
      >
        {event.recurrence && <span className="opacity-75 flex-shrink-0">↺</span>}
        {label}
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className={`${color} text-white rounded-lg p-3 cursor-pointer hover:opacity-90 transition-opacity`}
    >
      <div className="font-medium text-sm flex items-center gap-1">
        {event.recurrence && <span className="opacity-75">↺</span>}
        {event.title}
      </div>
      {!event.allDay && <div className="text-xs opacity-90 mt-0.5">{time}</div>}
      {event.allDay && <div className="text-xs opacity-90 mt-0.5">{t('allDay2')}</div>}
      {event.reminderAt && (
        <div className="text-xs opacity-75 mt-1">🔔 {t('reminderSet')}</div>
      )}
    </div>
  );
}
