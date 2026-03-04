import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/api-auth';
import { settingsUpdateSchema } from '@/lib/validations';
import { z } from 'zod';

export async function GET() {
  const result = await requireAuth();
  if ('error' in result) return result.error;

  const settings = await prisma.userSettings.findUnique({
    where: { userId: result.userId },
  });

  // Create defaults if missing
  if (!settings) {
    const created = await prisma.userSettings.create({
      data: { userId: result.userId },
    });
    return NextResponse.json({ settings: created });
  }

  return NextResponse.json({ settings });
}

export async function PATCH(req: NextRequest) {
  const result = await requireAuth();
  if ('error' in result) return result.error;

  try {
    const body = await req.json();
    const data = settingsUpdateSchema.parse(body);

    const settings = await prisma.userSettings.upsert({
      where: { userId: result.userId },
      create: { userId: result.userId, ...data },
      update: data,
    });

    return NextResponse.json({ settings });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
