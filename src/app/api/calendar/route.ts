import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuthWithLimit } from '@/lib/api-auth';
import { calendarEventCreateSchema } from '@/lib/validations';
import { z } from 'zod';

function serializeEvent(e: any) {
  return {
    ...e,
    amount: e.amount ? Number(e.amount) : null,
    date: e.date?.toISOString?.().slice(0, 10) ?? e.date,
  };
}

export async function GET() {
  const result = await requireAuthWithLimit('api:read');
  if ('error' in result) return result.error;

  const events = await prisma.calendarEvent.findMany({
    where: { userId: result.userId },
    orderBy: { date: 'asc' },
  });

  return NextResponse.json({ events: events.map(serializeEvent) });
}

export async function POST(req: NextRequest) {
  const result = await requireAuthWithLimit('api:write');
  if ('error' in result) return result.error;

  try {
    const body = await req.json();
    const data = calendarEventCreateSchema.parse(body);

    const event = await prisma.calendarEvent.create({
      data: {
        userId: result.userId,
        title: data.title,
        date: new Date(data.date),
        amount: data.amount,
        type: data.type,
        recurring: data.recurring,
        category: data.category,
      },
    });

    return NextResponse.json({ event: serializeEvent(event) }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
