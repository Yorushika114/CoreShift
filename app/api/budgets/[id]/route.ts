import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const budget = await prisma.timeBudget.update({
    where: { id: params.id },
    data: {
      ...(body.label !== undefined && { label: body.label }),
      ...(body.keywords !== undefined && { keywords: body.keywords }),
      ...(body.targetMinutes !== undefined && { targetMinutes: body.targetMinutes }),
      ...(body.color !== undefined && { color: body.color }),
    },
  });
  return NextResponse.json({ ...budget, createdAt: budget.createdAt.toISOString(), updatedAt: budget.updatedAt.toISOString() });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  await prisma.timeBudget.delete({ where: { id: params.id } });
  return new NextResponse(null, { status: 204 });
}
