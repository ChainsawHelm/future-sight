import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { plaidClient } from '@/lib/plaid';
import { prisma } from '@/lib/prisma';

export async function POST(req: any) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const plaidItems = await prisma.plaidItem.findMany({
      where: { userId: token.id as string, isActive: true },
    });
    if (plaidItems.length === 0) {
      return NextResponse.json({ error: 'No linked accounts' }, { status: 400 });
    }
    let totalAdded = 0, totalModified = 0, totalRemoved = 0;
    for (const item of plaidItems) {
      let hasMore = true;
      let cursor = item.cursor || undefined;
      while (hasMore) {
        const response = await plaidClient.transactionsSync({
          access_token: item.accessToken,
          cursor: cursor,
          count: 100,
        });
        const { added, modified, removed, next_cursor, has_more } = response.data;
        for (const txn of added) {
          const amount = -(txn.amount || 0);
          const date = txn.date || new Date().toISOString().split('T')[0];
          const existing = await prisma.transaction.findFirst({
            where: { userId: token.id as string, plaidTransactionId: txn.transaction_id },
          });
          if (!existing) {
            await prisma.transaction.create({
              data: {
                userId: token.id as string,
                date: new Date(date),
                description: txn.name || txn.merchant_name || 'Unknown',
                amount,
                category: txn.personal_finance_category?.primary || txn.category?.[0] || 'Uncategorized',
                account: item.institutionName || 'Plaid',
                plaidTransactionId: txn.transaction_id,
              },
            });
            totalAdded++;
          }
        }
        for (const txn of modified) {
          await prisma.transaction.updateMany({
            where: { userId: token.id as string, plaidTransactionId: txn.transaction_id },
            data: {
              description: txn.name || txn.merchant_name || 'Unknown',
              amount: -(txn.amount || 0),
              category: txn.personal_finance_category?.primary || txn.category?.[0] || 'Uncategorized',
            },
          });
          totalModified++;
        }
        for (const txn of removed) {
          if (txn.transaction_id) {
            await prisma.transaction.deleteMany({
              where: { userId: token.id as string, plaidTransactionId: txn.transaction_id },
            });
            totalRemoved++;
          }
        }
        cursor = next_cursor;
        hasMore = has_more;
      }
      await prisma.plaidItem.update({
        where: { id: item.id },
        data: { cursor, lastSynced: new Date() },
      });
    }
    return NextResponse.json({ success: true, added: totalAdded, modified: totalModified, removed: totalRemoved });
  } catch (err: any) {
    console.error('Plaid sync error:', err?.response?.data || err.message);
    return NextResponse.json({ error: 'Failed to sync transactions' }, { status: 500 });
  }
}
