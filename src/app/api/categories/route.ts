import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/api-auth';
import { categoryCreateSchema } from '@/lib/validations';
import { z } from 'zod';

export async function GET() {
  const result = await requireAuth();
  if ('error' in result) return result.error;

  const categories = await prisma.category.findMany({
    where: { userId: result.userId },
    orderBy: { sortOrder: 'asc' },
  });

  return NextResponse.json({ categories });
}

export async function POST(req: NextRequest) {
  const result = await requireAuth();
  if ('error' in result) return result.error;

  try {
    const body = await req.json();
    const data = categoryCreateSchema.parse(body);

    const category = await prisma.category.create({
      data: {
        userId: result.userId,
        ...data,
      },
    });

    return NextResponse.json({ category }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    if ((error as any)?.code === 'P2002') {
      return NextResponse.json({ error: 'Category already exists' }, { status: 409 });
    }
    console.error('POST /api/categories error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
