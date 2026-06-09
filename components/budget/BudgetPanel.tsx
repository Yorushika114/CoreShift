'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSettings } from '@/contexts/SettingsContext';
import type { BudgetProgress } from '@/types';

export function getWeekRange(): { start: string; end: string } {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const mon = new Date(now);
  mon.setDate(now.getDate() + diff);
  mon.setHours(0, 0, 0, 0);
  const sun = new Date(mon.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);
  return { start: mon.toISOString(), end: sun.toISOString() };
}

export function formatDuration(minutes: number, lang: string): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (lang === 'en') return `${h}h${m > 0 ? ' ' + m + 'm' : ''}`;
  return `${h > 0 ? h + '小时' : ''}${m > 0 ? m + '分钟' : h === 0 ? '0分钟' : ''}`;
}

const BAR_COLORS: Record<string, string> = {
  emerald: 'bg-emerald-500', blue: 'bg-blue-500', purple: 'bg-purple-500',
  orange: 'bg-orange-400', red: 'bg-red-500', pink: 'bg-pink-500',
  indigo: 'bg-indigo-500', yellow: 'bg-yellow-400',
};
const DOT_COLORS: Record<string, string> = {
  emerald: 'bg-emerald-500', blue: 'bg-blue-500', purple: 'bg-purple-500',
  orange: 'bg-orange-400', red: 'bg-red-500', pink: 'bg-pink-500',
  indigo: 'bg-indigo-500', yellow: 'bg-yellow-400',
};

export function BudgetPanel({ onEdit }: { onEdit: () => void }) {
  const { t, language } = useSettings();
  const [progresses, setProgresses] = useState<BudgetProgress[]>([]);

  const loadProgress = useCallback(async () => {
    try {
      const { start, end } = getWeekRange();
      const res = await fetch(`/api/budgets/progress?start=${start}&end=${end}`);
      if (res.ok) setProgresses(await res.json());
    } catch {
      // 网络不可用时静默失败，保留上次数据
    }
  }, []);

  useEffect(() => { loadProgress(); }, [loadProgress]);

  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') loadProgress(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', loadProgress);
    window.addEventListener('budget-updated', loadProgress);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', loadProgress);
      window.removeEventListener('budget-updated', loadProgress);
    };
  }, [loadProgress]);

  return (
    <>
      <div className="border border-gray-200 rounded-lg overflow-hidden text-sm">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-100">
          <span className="flex items-center gap-1.5 text-gray-700 font-medium text-xs">
            <span>🎯</span>
            {t('budgetTitle')}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={loadProgress}
              className="text-gray-400 hover:text-gray-600 transition px-1 text-xs"
              title={language === 'en' ? 'Refresh' : '刷新'}
            >
              ↻
            </button>
            <button
              onClick={onEdit}
              className="text-gray-400 hover:text-gray-600 transition px-1 text-xs"
              title={language === 'en' ? 'Manage goals' : '管理目标'}
            >
              ✏
            </button>
          </div>
        </div>

        {/* Progress list */}
        {progresses.length === 0 ? (
          <div className="px-3 py-3 text-center">
            <p className="text-xs text-gray-400">{t('budgetEmpty')}</p>
            <button
              onClick={onEdit}
              className="mt-1.5 text-xs text-blue-500 hover:text-blue-600 transition"
            >
              + {t('budgetAdd')}
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {progresses.map(p => {
              const pct = Math.min(p.percentage, 100);
              const done = p.percentage >= 100;
              const th = Math.floor(p.targetMinutes / 60);
              const tm = p.targetMinutes % 60;
              const bar = BAR_COLORS[p.color] ?? 'bg-emerald-500';
              const dot = DOT_COLORS[p.color] ?? 'bg-emerald-500';
              return (
                <div key={p.id} className="px-3 py-2">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dot}`} />
                    <span className="text-xs font-medium text-gray-700 truncate flex-1">{p.label}</span>
                    {done && <span className="text-xs text-emerald-600">✓</span>}
                    <span className="text-xs text-gray-400">{p.percentage}%</span>
                  </div>
                  <div className="h-1 bg-gray-100 rounded-full mb-1">
                    <div className={`h-1 rounded-full transition-all duration-500 ${bar}`} style={{ width: `${pct}%` }} />
                  </div>
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>{formatDuration(p.actualMinutes, language)}</span>
                    <span>
                      {language === 'en'
                        ? `/ ${th}h${tm > 0 ? ' ' + tm + 'm' : ''}`
                        : `/ ${th > 0 ? th + t('budgetHours') : ''}${tm > 0 ? tm + t('budgetMins') : ''}`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </>
  );
}
