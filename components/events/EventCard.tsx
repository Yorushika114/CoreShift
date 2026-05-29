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
