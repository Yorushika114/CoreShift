export const EVENT_COLORS = [
  'bg-blue-500', 'bg-green-600', 'bg-red-500',
  'bg-purple-500', 'bg-amber-500', 'bg-pink-500',
];

export function colorFor(id: string): string {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return EVENT_COLORS[h % EVENT_COLORS.length];
}
