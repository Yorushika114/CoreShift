import { colorFor, EVENT_COLOR_OPTIONS } from '@/lib/calendar/color-utils';

const allBgs = EVENT_COLOR_OPTIONS.map(c => c.bg);

describe('colorFor', () => {
  it('returns a bg class from EVENT_COLOR_OPTIONS', () => {
    expect(allBgs).toContain(colorFor({ id: 'test-id' }));
  });

  it('returns the same color for the same id', () => {
    expect(colorFor({ id: 'abc-123' })).toBe(colorFor({ id: 'abc-123' }));
  });

  it('returns different colors for different ids (distribution check)', () => {
    const ids = ['id-1', 'id-2', 'id-3', 'id-4', 'id-5', 'id-6'];
    const colors = new Set(ids.map(id => colorFor({ id })));
    expect(colors.size).toBeGreaterThan(1);
  });

  it('uses stored color when event.color is set', () => {
    expect(colorFor({ id: 'any-id', color: 'red' })).toBe('bg-red-500');
    expect(colorFor({ id: 'any-id', color: 'purple' })).toBe('bg-purple-500');
  });

  it('falls back to hash when event.color is null', () => {
    const result = colorFor({ id: 'test-id', color: null });
    expect(allBgs).toContain(result);
  });
});
