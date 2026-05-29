// __tests__/components/MiniCalendar.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { MiniCalendar } from '@/components/calendar/MiniCalendar';

const MAY_2026 = new Date(2026, 4, 15);

describe('MiniCalendar', () => {
  it('renders the current month and year', () => {
    render(<MiniCalendar selectedDate={MAY_2026} onDateSelect={jest.fn()} />);
    expect(screen.getByText('2026年5月')).toBeInTheDocument();
  });

  it('renders 7 weekday headers', () => {
    render(<MiniCalendar selectedDate={MAY_2026} onDateSelect={jest.fn()} />);
    ['日', '一', '二', '三', '四', '五', '六'].forEach(d => {
      expect(screen.getByText(d)).toBeInTheDocument();
    });
  });

  it('navigates to previous month', () => {
    render(<MiniCalendar selectedDate={MAY_2026} onDateSelect={jest.fn()} />);
    fireEvent.click(screen.getByLabelText('上个月'));
    expect(screen.getByText('2026年4月')).toBeInTheDocument();
  });

  it('navigates to next month', () => {
    render(<MiniCalendar selectedDate={MAY_2026} onDateSelect={jest.fn()} />);
    fireEvent.click(screen.getByLabelText('下个月'));
    expect(screen.getByText('2026年6月')).toBeInTheDocument();
  });

  it('calls onDateSelect when a day is clicked', () => {
    const onSelect = jest.fn();
    render(<MiniCalendar selectedDate={MAY_2026} onDateSelect={onSelect} />);
    const dayButtons = screen.getAllByRole('button');
    const day10 = dayButtons.find(b => b.textContent === '10');
    fireEvent.click(day10!);
    expect(onSelect).toHaveBeenCalled();
  });

  it('marks selected date visually (data-selected attribute)', () => {
    render(<MiniCalendar selectedDate={MAY_2026} onDateSelect={jest.fn()} />);
    const selected = screen.getAllByRole('button').find(
      b => b.getAttribute('data-selected') === 'true'
    );
    expect(selected).toBeDefined();
    expect(selected!.textContent).toBe('15');
  });
});
