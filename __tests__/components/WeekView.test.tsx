// __tests__/components/WeekView.test.tsx
import { render, screen, fireEvent, within } from '@testing-library/react';
import { WeekView } from '@/components/calendar/WeekView';
import type { CalendarEvent } from '@/types';

// 2026-05-25 is Monday
const WEEK_START = new Date(2026, 4, 25);

const events: CalendarEvent[] = [
  {
    id: 'ev-1',
    title: '周会',
    startAt: new Date(2026, 4, 26, 10, 0).toISOString(), // Tuesday 10:00
    endAt: new Date(2026, 4, 26, 11, 0).toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

describe('WeekView', () => {
  it('renders 7 day column headers', () => {
    render(<WeekView startDate={WEEK_START} events={[]} use24h={true} onDayClick={jest.fn()} />);
    ['周一', '周二', '周三', '周四', '周五', '周六', '周日'].forEach(d =>
      expect(screen.getByText(d)).toBeInTheDocument()
    );
  });

  it('renders correct dates in headers', () => {
    render(<WeekView startDate={WEEK_START} events={[]} use24h={true} onDayClick={jest.fn()} />);
    [25, 26, 27, 28, 29, 30, 31].forEach(d =>
      expect(screen.getAllByText(String(d)).length).toBeGreaterThan(0)
    );
  });

  it('shows event in the correct day column', () => {
    render(<WeekView startDate={WEEK_START} events={events} use24h={true} onDayClick={jest.fn()} />);
    expect(screen.getByText('周会')).toBeInTheDocument();
  });

  it('shows event time in 24h format', () => {
    render(<WeekView startDate={WEEK_START} events={events} use24h={true} onDayClick={jest.fn()} />);
    const block = screen.getByTestId('week-event-ev-1');
    expect(within(block).getByText('10:00')).toBeInTheDocument();
  });

  it('shows event time in 12h format', () => {
    render(<WeekView startDate={WEEK_START} events={events} use24h={false} onDayClick={jest.fn()} />);
    const block = screen.getByTestId('week-event-ev-1');
    expect(within(block).getByText('上午 10:00')).toBeInTheDocument();
  });

  it('calls onDayClick when day header is clicked', () => {
    const onDayClick = jest.fn();
    render(<WeekView startDate={WEEK_START} events={[]} use24h={true} onDayClick={onDayClick} />);
    fireEvent.click(screen.getByTestId('day-header-0')); // Monday
    expect(onDayClick).toHaveBeenCalledTimes(1);
    const arg: Date = onDayClick.mock.calls[0][0];
    expect(arg.getDate()).toBe(25);
  });
});
