// __tests__/components/MonthGrid.test.tsx
import { render, screen } from '@testing-library/react';
import { MonthGrid } from '@/components/calendar/MonthGrid';
import { SettingsProvider } from '@/contexts/SettingsContext';
import type { CalendarEvent } from '@/types';

const MAY_2026 = new Date(2026, 4, 1);

const events: CalendarEvent[] = [
  {
    id: 'ev-1',
    title: '组会',
    startAt: new Date(2026, 4, 29, 15, 0).toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ev-2',
    title: '算法课',
    startAt: new Date(2026, 4, 29, 9, 0).toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

beforeEach(() => localStorage.clear());

function renderInProvider(ui: React.ReactElement) {
  return render(<SettingsProvider>{ui}</SettingsProvider>);
}

describe('MonthGrid', () => {
  it('renders month year header', () => {
    renderInProvider(<MonthGrid viewDate={MAY_2026} events={[]} onDateClick={jest.fn()} />);
    expect(screen.getByText('2026年5月')).toBeInTheDocument();
  });

  it('renders all 7 weekday column headers', () => {
    renderInProvider(<MonthGrid viewDate={MAY_2026} events={[]} onDateClick={jest.fn()} />);
    ['周日', '周一', '周二', '周三', '周四', '周五', '周六'].forEach(h => {
      expect(screen.getByText(h)).toBeInTheDocument();
    });
  });

  it('shows events on the correct date cell', () => {
    renderInProvider(<MonthGrid viewDate={MAY_2026} events={events} onDateClick={jest.fn()} />);
    expect(screen.getByText(/组会/)).toBeInTheDocument();
    expect(screen.getByText(/算法课/)).toBeInTheDocument();
  });

  it('shows overflow label when more than 3 events on a day', () => {
    const manyEvents: CalendarEvent[] = Array.from({ length: 5 }, (_, i) => ({
      id: `ov-${i}`,
      title: `事件${i}`,
      startAt: new Date(2026, 4, 29, 9 + i, 0).toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));
    renderInProvider(<MonthGrid viewDate={MAY_2026} events={manyEvents} onDateClick={jest.fn()} />);
    expect(screen.getByText('+2 更多')).toBeInTheDocument();
  });
});
