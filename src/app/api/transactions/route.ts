import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuthWithLimit } from '@/lib/api-auth';
import { transactionCreateSchema, transactionQuerySchema } from '@/lib/validations';
import { sanitizeString } from '@/lib/sanitize';
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
      // Find accounts whose nickname matches the search term
      const matchingNicknames = await prisma.accountNickname.findMany({
        where: {
          userId,
          nickname: { contains: query.search, mode: 'insensitive' },
        },
        select: { accountName: true },
      });
      const nicknameAccounts = matchingNicknames.map(n => n.accountName);

      where.OR = [
        { description: { contains: query.search, mode: 'insensitive' } },
        { originalDescription: { contains: query.search, mode: 'insensitive' } },
        { note: { contains: query.search, mode: 'insensitive' } },
        { account: { contains: query.search, mode: 'insensitive' } },
        ...(nicknameAccounts.length > 0 ? [{ account: { in: nicknameAccounts } }] : []),
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

    const [transactions, total, aggregates] = await Promise.all([
      prisma.transaction.findMany({
        where,
        orderBy: { [query.sort]: query.order },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      prisma.transaction.count({ where }),
      prisma.$queryRawUnsafe<{ income: string; expenses: string }[]>(
        `SELECT
          COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) AS income,
          COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END), 0) AS expenses
        FROM transactions
        WHERE ${buildRawWhere(where, userId)}`
      ),
    ]);

    const agg = aggregates[0] || { income: '0', expenses: '0' };

    return NextResponse.json({
      transactions: transactions.map(serializeTxn),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
      totals: {
        income: Number(agg.income),
        expenses: Number(agg.expenses),
        net: Number(agg.income) - Number(agg.expenses),
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
        description: sanitizeString(data.description),
        originalDescription: data.originalDescription ? sanitizeString(data.originalDescription) : null,
        amount: data.amount,
        category: sanitizeString(data.category),
        account: sanitizeString(data.account),
        autoMatched: data.autoMatched,
        flagged: data.flagged,
        transferPairId: data.transferPairId,
        returnPairId: data.returnPairId,
        note: data.note ? sanitizeString(data.note) : null,
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

// Build a simplified raw WHERE clause for aggregate queries
// This mirrors the Prisma where object for the most common filters
function buildRawWhere(where: Prisma.TransactionWhereInput, userId: string): string {
  const conditions: string[] = [`"userId" = '${userId.replace(/'/g, "''")}'`];

  if (where.category && typeof where.category === 'string') {
    conditions.push(`"category" = '${where.category.replace(/'/g, "''")}'`);
  }
  if (where.account && typeof where.account === 'string') {
    conditions.push(`"account" = '${where.account.replace(/'/g, "''")}'`);
  }
  if (where.date && typeof where.date === 'object') {
    const d = where.date as { gte?: Date; lte?: Date };
    if (d.gte) conditions.push(`"date" >= '${d.gte.toISOString().slice(0, 10)}'`);
    if (d.lte) conditions.push(`"date" <= '${d.lte.toISOString().slice(0, 10)}'`);
  }
  if (where.OR && Array.isArray(where.OR)) {
    const orParts: string[] = [];
    for (const clause of where.OR) {
      const c = clause as any;
      if (c.description?.contains) {
        orParts.push(`"description" ILIKE '%${c.description.contains.replace(/'/g, "''").replace(/%/g, '\\%')}%'`);
      }
      if (c.originalDescription?.contains) {
        orParts.push(`"originalDescription" ILIKE '%${c.originalDescription.contains.replace(/'/g, "''").replace(/%/g, '\\%')}%'`);
      }
      if (c.note?.contains) {
        orParts.push(`"note" ILIKE '%${c.note.contains.replace(/'/g, "''").replace(/%/g, '\\%')}%'`);
      }
      if (c.account?.contains) {
        orParts.push(`"account" ILIKE '%${c.account.contains.replace(/'/g, "''").replace(/%/g, '\\%')}%'`);
      }
      if (c.account?.in && Array.isArray(c.account.in)) {
        const vals = c.account.in.map((v: string) => `'${v.replace(/'/g, "''")}'`).join(',');
        orParts.push(`"account" IN (${vals})`);
      }
    }
    if (orParts.length > 0) conditions.push(`(${orParts.join(' OR ')})`);
  }

  return conditions.join(' AND ');
}

// Serialize Decimal fields to numbers for JSON
function serializeTxn(t: any) {
  return {
    ...t,
    amount: Number(t.amount),
    date: t.date instanceof Date ? t.date.toISOString().slice(0, 10) : t.date,
  };
}
