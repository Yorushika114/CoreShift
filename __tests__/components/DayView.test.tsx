// __tests__/components/DayView.test.tsx
import { render, screen, within } from '@testing-library/react';
import { DayView } from '@/components/calendar/DayView';
import { SettingsProvider } from '@/contexts/SettingsContext';
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

beforeEach(() => localStorage.clear());

function renderInProvider(ui: React.ReactElement) {
  return render(<SettingsProvider>{ui}</SettingsProvider>);
}

describe('DayView', () => {
  it('renders 48 time slots', () => {
    renderInProvider(<DayView date={MAY_29} events={[]} />);
    expect(screen.getAllByTestId('time-slot').length).toBe(48);
  });

  it('shows event title', () => {
    renderInProvider(<DayView date={MAY_29} events={events} />);
    expect(screen.getByText('组会')).toBeInTheDocument();
  });

  it('shows event time in 24h format', () => {
    renderInProvider(<DayView date={MAY_29} events={events} />);
    const block = screen.getByTestId('event-block-ev-1');
    expect(within(block).getByText('15:00')).toBeInTheDocument();
  });

  it('shows event time in 12h format', () => {
    localStorage.setItem('cs_use24h', 'false');
    renderInProvider(<DayView date={MAY_29} events={events} />);
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
    renderInProvider(<DayView date={MAY_29} events={[otherDayEvent]} />);
    expect(screen.queryByText('其他天的事件')).not.toBeInTheDocument();
  });
});
