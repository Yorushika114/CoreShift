// __tests__/components/DayView.test.tsx
import { render, screen, within } from '@testing-library/react';
import { DayView } from '@/components/calendar/DayView';
import type { CalendarEvent } from '@/types';

const MAY_29 = new Date(2026, 4, 29);

const events: CalendarEvent[] = [
  {
    id: 'ev-1',
    title: '组会',
    startAt: new Date(2026, 4, 29, 15, 0).toISOString(),
    endAt: new Date(2026, 4, 29, 16, 0).toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

describe('DayView', () => {
  it('renders 48 time slots', () => {
    render(<DayView date={MAY_29} events={[]} use24h={true} />);
    expect(screen.getAllByTestId('time-slot').length).toBe(48);
  });

  it('shows event title', () => {
    render(<DayView date={MAY_29} events={events} use24h={true} />);
    expect(screen.getByText('组会')).toBeInTheDocument();
  });

  it('shows event time in 24h format', () => {
    render(<DayView date={MAY_29} events={events} use24h={true} />);
    const block = screen.getByTestId('event-block-ev-1');
    expect(within(block).getByText('15:00')).toBeInTheDocument();
  });

  it('shows event time in 12h format', () => {
    render(<DayView date={MAY_29} events={events} use24h={false} />);
    const block = screen.getByTestId('event-block-ev-1');
    expect(within(block).getByText('下午 3:00')).toBeInTheDocument();
  });

  it('does not show events from other days', () => {
    const otherDayEvent: CalendarEvent = {
      id: 'ev-other',
      title: '其他天的事件',
      startAt: new Date(2026, 4, 30, 10, 0).toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    render(<DayView date={MAY_29} events={[otherDayEvent]} use24h={true} />);
    expect(screen.queryByText('其他天的事件')).not.toBeInTheDocument();
  });
});
