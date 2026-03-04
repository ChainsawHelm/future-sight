import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/api-auth';
import { calendarEventUpdateSchema } from '@/lib/validations';
import { z } from 'zod';

interface Params { params: { id: string } }

export async function PATCH(req: NextRequest, { params }: Params) {
  const result = await requireAuth();
  if ('error' in result) return result.error;

  try {
    const existing = await prisma.calendarEvent.findFirst({
      where: { id: params.id, userId: result.userId },
    });
    if (!existing) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

    const body = await req.json();
    const data = calendarEventUpdateSchema.parse(body);

    const updateData: any = { ...data };
    if (data.date) updateData.date = new Date(data.date);

    const event = await prisma.calendarEvent.update({ where: { id: params.id }, data: updateData });

    return NextResponse.json({
      event: { ...event, amount: event.amount ? Number(event.amount) : null, date: event.date.toISOString().slice(0, 10) },
    });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const result = await requireAuth();
  if ('error' in result) return result.error;

  const existing = await prisma.calendarEvent.findFirst({
    where: { id: params.id, userId: result.userId },
  });
  if (!existing) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

  await prisma.calendarEvent.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
