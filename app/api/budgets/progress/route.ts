import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { BudgetProgress } from '@/types';
import { requireAuth, unauthorized } from '@/lib/auth';

export const dynamic = 'force-dynamic';

function matchesKeywords(title: string, keywords: string[]): boolean {
  const lower = title.toLowerCase();
  return keywords.some(kw => kw.trim() && lower.includes(kw.trim().toLowerCase()));
}

function eventMinutes(startAt: Date, endAt: Date | null): number {
  if (!endAt) return 60;
  const mins = Math.round((endAt.getTime() - startAt.getTime()) / 60000);
  return Math.max(mins, 0);
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return unauthorized();

  const { searchParams } = new URL(req.url);
  const startParam = searchParams.get('start');
  const endParam = searchParams.get('end');

  if (!startParam || !endParam) {
    return NextResponse.json({ error: 'start and end are required' }, { status: 400 });
  }

  const rangeStart = new Date(startParam);
  const rangeEnd = new Date(endParam);

  const [budgets, events] = await Promise.all([
    prisma.timeBudget.findMany({ where: { userId: auth.userId }, orderBy: { createdAt: 'asc' } }),
    prisma.event.findMany({
      where: { userId: auth.userId, allDay: false, startAt: { gte: rangeStart, lte: rangeEnd } },
      select: { title: true, startAt: true, endAt: true },
    }),
  ]);

  const progresses: BudgetProgress[] = budgets.map(b => {
    const kws = b.keywords.split(',');
    const actualMinutes = events
      .filter(e => matchesKeywords(e.title, kws))
      .reduce((sum, e) => sum + eventMinutes(e.startAt, e.endAt), 0);
    const percentage = b.targetMinutes > 0 ? Math.round((actualMinutes / b.targetMinutes) * 100) : 0;
    return {
      id: b.id, label: b.label, keywords: b.keywords,
      targetMinutes: b.targetMinutes, color: b.color,
      createdAt: b.createdAt.toISOString(), updatedAt: b.updatedAt.toISOString(),
      actualMinutes, percentage,
    };
  });

  return NextResponse.json(progresses);
}
