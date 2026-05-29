// __tests__/components/YearGrid.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { YearGrid } from '@/components/calendar/YearGrid';
import type { CalendarEvent } from '@/types';

const events: CalendarEvent[] = [
  {
    id: 'ev-1',
    title: '组会',
    startAt: new Date(2026, 4, 29, 15, 0).toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

describe('YearGrid', () => {
  it('renders 12 month cards', () => {
    render(<YearGrid year={2026} events={[]} onMonthClick={jest.fn()} />);
    ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月']
      .forEach(m => expect(screen.getByText(m)).toBeInTheDocument());
  });

  it('shows event dot for dates with events', () => {
    render(<YearGrid year={2026} events={events} onMonthClick={jest.fn()} />);
    expect(screen.getAllByTestId('event-dot').length).toBeGreaterThan(0);
  });

  it('does not show event dots when no events', () => {
    render(<YearGrid year={2026} events={[]} onMonthClick={jest.fn()} />);
    expect(screen.queryAllByTestId('event-dot').length).toBe(0);
  });

  it('calls onMonthClick with correct month and year when card is clicked', () => {
    const onMonthClick = jest.fn();
    render(<YearGrid year={2026} events={[]} onMonthClick={onMonthClick} />);
    fireEvent.click(screen.getByTestId('month-card-4')); // May = index 4
    expect(onMonthClick).toHaveBeenCalledTimes(1);
    const arg: Date = onMonthClick.mock.calls[0][0];
    expect(arg.getFullYear()).toBe(2026);
    expect(arg.getMonth()).toBe(4);
    expect(arg.getDate()).toBe(1);
  });
});
