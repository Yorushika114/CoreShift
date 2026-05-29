import { colorFor, EVENT_COLORS } from '@/lib/calendar/color-utils';

describe('colorFor', () => {
  it('returns a string from EVENT_COLORS', () => {
    expect(EVENT_COLORS).toContain(colorFor('test-id'));
  });

  it('returns the same color for the same id', () => {
    expect(colorFor('abc-123')).toBe(colorFor('abc-123'));
  });

  it('returns different colors for different ids (distribution check)', () => {
    const ids = ['id-1', 'id-2', 'id-3', 'id-4', 'id-5', 'id-6'];
    const colors = new Set(ids.map(colorFor));
    expect(colors.size).toBeGreaterThan(1);
  });
});
