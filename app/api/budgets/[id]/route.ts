import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, unauthorized } from '@/lib/auth';

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req);
  if (!auth) return unauthorized();

  const body = await req.json();
  const budget = await prisma.timeBudget.update({
    where: { id: params.id, userId: auth.userId },
    data: {
      ...(body.label !== undefined && { label: body.label }),
      ...(body.keywords !== undefined && { keywords: body.keywords }),
      ...(body.targetMinutes !== undefined && { targetMinutes: body.targetMinutes }),
      ...(body.color !== undefined && { color: body.color }),
    },
  });
  return NextResponse.json({ ...budget, createdAt: budget.createdAt.toISOString(), updatedAt: budget.updatedAt.toISOString() });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req);
  if (!auth) return unauthorized();

  await prisma.timeBudget.delete({ where: { id: params.id, userId: auth.userId } });
  return new NextResponse(null, { status: 204 });
}
