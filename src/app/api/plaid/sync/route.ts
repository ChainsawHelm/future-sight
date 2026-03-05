import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { plaidClient } from '@/lib/plaid';
import { prisma } from '@/lib/prisma';

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const plaidItems = await prisma.plaidItem.findMany({
      where: { userId: session.user.id, isActive: true },
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
          access_token: item.accessToken, cursor, count: 100,
        });
        const { added, modified, removed, next_cursor, has_more } = response.data;
        for (const txn of added) {
          const existing = await prisma.transaction.findFirst({
            where: { userId: session.user.id, plaidTransactionId: txn.transaction_id },
          });
          if (!existing) {
            await prisma.transaction.create({
              data: {
                userId: session.user.id,
                date: new Date(txn.date || new Date().toISOString().split('T')[0]),
                description: txn.name || txn.merchant_name || 'Unknown',
                amount: -(txn.amount || 0),
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
            where: { userId: session.user.id, plaidTransactionId: txn.transaction_id },
            data: { description: txn.name || txn.merchant_name || 'Unknown', amount: -(txn.amount || 0) },
          });
          totalModified++;
        }
        for (const txn of removed) {
          if (txn.transaction_id) {
            await prisma.transaction.deleteMany({
              where: { userId: session.user.id, plaidTransactionId: txn.transaction_id },
            });
            totalRemoved++;
          }
        }
        cursor = next_cursor;
        hasMore = has_more;
      }
      await prisma.plaidItem.update({
        where: { id: item.id }, data: { cursor, lastSynced: new Date() },
      });
    }
    return NextResponse.json({ success: true, added: totalAdded, modified: totalModified, removed: totalRemoved });
  } catch (err: any) {
    console.error('Plaid sync error:', err?.response?.data || err.message);
    return NextResponse.json({ error: 'Failed to sync' }, { status: 500 });
  }
}
