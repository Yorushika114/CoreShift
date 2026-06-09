'use client';

import { useSettings } from '@/contexts/SettingsContext';

export type RecurringActionMode = 'this' | 'future' | 'all';

interface Props {
  action: 'delete' | 'modify';
  onSelect: (mode: RecurringActionMode) => void;
  onCancel: () => void;
}

export function RecurringActionDialog({ action, onSelect, onCancel }: Props) {
  const { language } = useSettings();
  const isZh = language === 'zh';

  const labels = {
    title: action === 'delete'
      ? (isZh ? '删除重复事件' : 'Delete recurring event')
      : (isZh ? '修改重复事件' : 'Edit recurring event'),
    this: isZh ? '仅此次' : 'This event only',
    future: isZh ? '此后全部' : 'This and following events',
    all: isZh ? '全部' : 'All events',
    cancel: isZh ? '取消' : 'Cancel',
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100">
          <h3 className="text-base font-semibold text-gray-800">{labels.title}</h3>
        </div>
        <div className="divide-y divide-gray-100">
          {(['this', 'future', 'all'] as RecurringActionMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => onSelect(mode)}
              className="w-full px-6 py-4 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              {labels[mode]}
            </button>
          ))}
        </div>
        <div className="px-6 py-4 border-t border-gray-100">
          <button
            onClick={onCancel}
            className="w-full text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
            {labels.cancel}
          </button>
        </div>
      </div>
    </div>
  );
}
