'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSettings } from '@/contexts/SettingsContext';
import { AppIcon } from '@/components/ui/AppIcon';
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
  const [collapsed, setCollapsed] = useState(true);

  const loadProgress = useCallback(async () => {
    const { start, end } = getWeekRange();
    const res = await fetch(`/api/budgets/progress?start=${start}&end=${end}`);
    if (res.ok) setProgresses(await res.json());
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
      <div className="border border-slate-200 rounded-lg overflow-hidden text-sm bg-white">
        {/* Header */}
        <div
          className="flex items-center justify-between px-3 py-2 bg-slate-50 border-b border-slate-100 cursor-pointer select-none hover:bg-slate-100 transition"
          onClick={() => setCollapsed(v => !v)}
        >
          <span className="flex items-center gap-1.5 text-slate-700 font-medium text-xs flex-1">
            <AppIcon name="target" className="h-4 w-4 text-slate-500" />
            {t('budgetTitle')}
          </span>
          <AppIcon
            name="chevron-down"
            className="h-3.5 w-3.5 text-slate-400 transition-transform duration-200 flex-shrink-0"
            style={{ display: 'inline-block', transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}
          />
          <div className="flex items-center gap-1 ml-1" onClick={e => e.stopPropagation()}>
            <button
              onClick={loadProgress}
              className="text-slate-400 hover:text-slate-600 transition p-1"
              title={language === 'en' ? 'Refresh' : '刷新'}
            >
              <AppIcon name="refresh" className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={onEdit}
              className="text-slate-400 hover:text-slate-600 transition p-1"
              title={language === 'en' ? 'Manage goals' : '管理目标'}
            >
              <AppIcon name="edit" className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Progress list */}
        {!collapsed && (
          <>
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
          </>
        )}
      </div>

    </>
  );
}
