import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

function toBudget(b: { id: string; label: string; keywords: string; targetMinutes: number; color: string; createdAt: Date; updatedAt: Date }) {
  return { ...b, createdAt: b.createdAt.toISOString(), updatedAt: b.updatedAt.toISOString() };
}

export async function GET() {
  const budgets = await prisma.timeBudget.findMany({ orderBy: { createdAt: 'asc' } });
  return NextResponse.json(budgets.map(toBudget));
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!body.label || typeof body.targetMinutes !== 'number') {
    return NextResponse.json({ error: 'label and targetMinutes are required' }, { status: 400 });
  }
  const budget = await prisma.timeBudget.create({
    data: {
      label: body.label,
      keywords: body.keywords ?? '',
      targetMinutes: body.targetMinutes,
      color: body.color ?? 'emerald',
    },
  });
  return NextResponse.json(toBudget(budget), { status: 201 });
}
