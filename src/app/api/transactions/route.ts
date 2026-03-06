import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuthWithLimit } from '@/lib/api-auth';
import { transactionCreateSchema, transactionQuerySchema } from '@/lib/validations';
import { Prisma } from '@prisma/client';
import { z } from 'zod';

export async function GET(req: NextRequest) {
  const result = await requireAuthWithLimit('api:read');
  if ('error' in result) return result.error;
  const { userId } = result;

  try {
    const params = Object.fromEntries(req.nextUrl.searchParams);
    const query = transactionQuerySchema.parse(params);

    // Build where clause
    const where: Prisma.TransactionWhereInput = { userId };

    if (query.category) where.category = query.category;
    if (query.account) where.account = query.account;
    if (query.flagged !== undefined) where.flagged = query.flagged;

    if (query.search) {
      where.OR = [
        { description: { contains: query.search, mode: 'insensitive' } },
        { originalDescription: { contains: query.search, mode: 'insensitive' } },
        { note: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (query.dateFrom || query.dateTo) {
      where.date = {};
      if (query.dateFrom) where.date.gte = new Date(query.dateFrom);
      if (query.dateTo) where.date.lte = new Date(query.dateTo);
    }

    if (query.amountMin !== undefined || query.amountMax !== undefined) {
      where.amount = {};
      if (query.amountMin !== undefined) where.amount.gte = query.amountMin;
      if (query.amountMax !== undefined) where.amount.lte = query.amountMax;
    }

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        orderBy: { [query.sort]: query.order },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      prisma.transaction.count({ where }),
    ]);

    return NextResponse.json({
      transactions: transactions.map(serializeTxn),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    console.error('GET /api/transactions error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const result = await requireAuthWithLimit('api:write');
  if ('error' in result) return result.error;
  const { userId } = result;

  try {
    const body = await req.json();
    const data = transactionCreateSchema.parse(body);

    const transaction = await prisma.transaction.create({
      data: {
        userId,
        date: new Date(data.date),
        description: data.description,
        originalDescription: data.originalDescription,
        amount: data.amount,
        category: data.category,
        account: data.account,
        autoMatched: data.autoMatched,
        flagged: data.flagged,
        transferPairId: data.transferPairId,
        returnPairId: data.returnPairId,
        note: data.note,
      },
    });

    return NextResponse.json({ transaction: serializeTxn(transaction) }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    console.error('POST /api/transactions error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Serialize Decimal fields to numbers for JSON
function serializeTxn(t: any) {
  return {
    ...t,
    amount: Number(t.amount),
    date: t.date instanceof Date ? t.date.toISOString().slice(0, 10) : t.date,
  };
}
