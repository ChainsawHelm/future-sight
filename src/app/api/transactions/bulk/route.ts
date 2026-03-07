import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuthWithLimit } from '@/lib/api-auth';
import {
  transactionBulkCreateSchema,
  transactionBulkUpdateSchema,
  transactionBulkDeleteSchema,
} from '@/lib/validations';
import { sanitizeString } from '@/lib/sanitize';
import { z } from 'zod';

// POST /api/transactions/bulk — bulk create (import pipeline)
export async function POST(req: NextRequest) {
  const result = await requireAuthWithLimit('api:bulk');
  if ('error' in result) return result.error;
  const { userId } = result;

  try {
    const body = await req.json();
    console.log(`[bulk-import] Received ${body?.transactions?.length ?? 0} transactions, importRecord: ${!!body?.importRecord}`);
    const data = transactionBulkCreateSchema.parse(body);

    let importRecordId: string | undefined;

    // Create import record if provided
    if (data.importRecord) {
      const dates = data.transactions.map((t) => t.date).sort();
      const dateRange = dates.length > 1
        ? `${dates[0]} → ${dates[dates.length - 1]}`
        : dates[0] || '';

      const record = await prisma.importRecord.create({
        data: {
          userId,
          filename: data.importRecord.filename,
          sourceType: data.importRecord.sourceType,
          count: data.transactions.length,
          dateRange,
        },
      });
      importRecordId = record.id;
    }

    // Bulk insert transactions (sanitize string inputs)
    const created = await prisma.transaction.createMany({
      data: data.transactions.map((t) => ({
        userId,
        date: new Date(t.date),
        description: sanitizeString(t.description),
        originalDescription: t.originalDescription ? sanitizeString(t.originalDescription) : null,
        amount: t.amount,
        category: sanitizeString(t.category),
        account: sanitizeString(t.account),
        autoMatched: t.autoMatched,
        flagged: t.flagged,
        transferPairId: t.transferPairId,
        returnPairId: t.returnPairId,
        note: t.note ? sanitizeString(t.note) : null,
        importRecordId,
      })),
    });

    console.log(`[bulk-import] Created ${created.count} transactions`);
    return NextResponse.json({
      created: created.count,
      importRecordId,
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('[bulk-import] Zod validation error:', error.errors);
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    console.error('[bulk-import] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/transactions/bulk — bulk update (e.g., bulk recategorize)
export async function PATCH(req: NextRequest) {
  const result = await requireAuthWithLimit('api:bulk');
  if ('error' in result) return result.error;
  const { userId } = result;

  try {
    const body = await req.json();
    const data = transactionBulkUpdateSchema.parse(body);

    const updateData: any = { ...data.update };
    if (data.update.date) updateData.date = new Date(data.update.date);

    const updated = await prisma.transaction.updateMany({
      where: {
        id: { in: data.ids },
        userId, // Security: only update own transactions
      },
      data: updateData,
    });

    return NextResponse.json({ updated: updated.count });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    console.error('PATCH /api/transactions/bulk error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/transactions/bulk — bulk delete
export async function DELETE(req: NextRequest) {
  const result = await requireAuthWithLimit('api:bulk');
  if ('error' in result) return result.error;
  const { userId } = result;

  try {
    const body = await req.json();
    const data = transactionBulkDeleteSchema.parse(body);

    const deleted = await prisma.transaction.deleteMany({
      where: {
        id: { in: data.ids },
        userId,
      },
    });

    return NextResponse.json({ deleted: deleted.count });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    console.error('DELETE /api/transactions/bulk error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
