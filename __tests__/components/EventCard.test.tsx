// __tests__/components/EventCard.test.tsx
import { render, screen } from '@testing-library/react';
import { EventCard } from '@/components/events/EventCard';
import { SettingsProvider } from '@/contexts/SettingsContext';
import type { CalendarEvent } from '@/types';

const event: CalendarEvent = {
  id: 'test-1',
  title: '组会',
  startAt: new Date(2026, 4, 29, 15, 0).toISOString(),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const eventWithReminder: CalendarEvent = {
  ...event,
  id: 'test-2',
  reminderAt: new Date(2026, 4, 29, 14, 45).toISOString(),
};

beforeEach(() => localStorage.clear());

function renderInProvider(ui: React.ReactElement) {
  return render(<SettingsProvider>{ui}</SettingsProvider>);
}

describe('EventCard', () => {
  it('renders event title', () => {
    renderInProvider(<EventCard event={event} />);
    expect(screen.getByText('组会')).toBeInTheDocument();
  });

  it('renders time (default 24h format)', () => {
    renderInProvider(<EventCard event={event} />);
    expect(screen.getByText('15:00')).toBeInTheDocument();
  });

  it('shows reminder indicator when reminderAt is set', () => {
    renderInProvider(<EventCard event={eventWithReminder} />);
    expect(screen.getByText(/提醒/)).toBeInTheDocument();
  });

  it('does not show reminder indicator when no reminderAt', () => {
    renderInProvider(<EventCard event={event} />);
    expect(screen.queryByText(/提醒/)).not.toBeInTheDocument();
  });

  it('renders compact version with title and time', () => {
    renderInProvider(<EventCard event={event} compact />);
    expect(screen.getByText(/组会/)).toBeInTheDocument();
  });
});
