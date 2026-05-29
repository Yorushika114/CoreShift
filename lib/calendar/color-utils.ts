export const EVENT_COLOR_OPTIONS = [
  { id: 'blue',   label: '蓝色', bg: 'bg-blue-500' },
  { id: 'green',  label: '绿色', bg: 'bg-green-500' },
  { id: 'red',    label: '红色', bg: 'bg-red-500' },
  { id: 'orange', label: '橙色', bg: 'bg-orange-500' },
  { id: 'purple', label: '紫色', bg: 'bg-purple-500' },
  { id: 'pink',   label: '粉色', bg: 'bg-pink-500' },
  { id: 'teal',   label: '青色', bg: 'bg-teal-500' },
  { id: 'slate',  label: '灰色', bg: 'bg-slate-500' },
] as const;

export type EventColorId = typeof EVENT_COLOR_OPTIONS[number]['id'];

export function colorFor(event: { id: string; color?: string | null }): string {
  if (event.color) {
    const found = EVENT_COLOR_OPTIONS.find(c => c.id === event.color);
    if (found) return found.bg;
  }
  // fallback: hash-based for events without a stored color
  let h = 0;
  for (const c of event.id) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return EVENT_COLOR_OPTIONS[h % EVENT_COLOR_OPTIONS.length].bg;
}
