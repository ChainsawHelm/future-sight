import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { plaidClient } from '@/lib/plaid';
import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/encryption';
import { rateLimit, getRateLimitHeaders } from '@/lib/rate-limit';

// ─── Plaid category → app category ──────────
const PLAID_CATEGORY_MAP: Record<string, string> = {
  INCOME: 'Income',
  TRANSFER_IN: 'Transfer',
  TRANSFER_OUT: 'Transfer',
  LOAN_PAYMENTS: 'Debt Payment',
  BANK_FEES: 'Bank Fees',
  ENTERTAINMENT: 'Entertainment',
  FOOD_AND_DRINK: 'Food & Drink',
  GENERAL_MERCHANDISE: 'Shopping',
  HOME_IMPROVEMENT: 'Home',
  MEDICAL: 'Healthcare',
  PERSONAL_CARE: 'Personal Care',
  GENERAL_SERVICES: 'Bills & Utilities',
  GOVERNMENT_AND_NON_PROFIT: 'Other',
  TRANSPORTATION: 'Transportation',
  TRAVEL: 'Travel',
  RENT_AND_UTILITIES: 'Bills & Utilities',
};

function mapPlaidCategory(txn: any): string {
  const primary = txn.personal_finance_category?.primary;
  if (primary && PLAID_CATEGORY_MAP[primary]) return PLAID_CATEGORY_MAP[primary];
  return txn.category?.[0] ?? 'Uncategorized';
}

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;

  // Rate limit Plaid sync
  const rl = rateLimit(userId, 'api:plaid');
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: getRateLimitHeaders(rl) }
    );
  }

  try {
    const plaidItems = await prisma.plaidItem.findMany({
      where: { userId, isActive: true },
    });
    if (plaidItems.length === 0) {
      return NextResponse.json({ error: 'No linked accounts' }, { status: 400 });
    }

    let totalAdded = 0, totalModified = 0, totalRemoved = 0;

    for (const item of plaidItems) {
      // ── 1. Fetch and upsert individual accounts ──────────────────
      const decryptedToken = decrypt(item.accessToken);
      const accountsRes = await plaidClient.accountsGet({ access_token: decryptedToken });
      const accountIdToName: Record<string, string> = {};

      for (const acct of accountsRes.data.accounts) {
        accountIdToName[acct.account_id] = acct.name;

        await prisma.plaidAccount.upsert({
          where: { accountId: acct.account_id },
          update: {
            name: acct.name,
            officialName: acct.official_name ?? null,
            type: acct.type,
            subtype: acct.subtype ?? null,
            currentBalance: acct.balances.current ?? null,
            availableBalance: acct.balances.available ?? null,
            limitBalance: acct.balances.limit ?? null,
            mask: acct.mask ?? null,
            isoCurrencyCode: acct.balances.iso_currency_code ?? null,
          },
          create: {
            userId,
            plaidItemId: item.id,
            accountId: acct.account_id,
            name: acct.name,
            officialName: acct.official_name ?? null,
            type: acct.type,
            subtype: acct.subtype ?? null,
            currentBalance: acct.balances.current ?? null,
            availableBalance: acct.balances.available ?? null,
            limitBalance: acct.balances.limit ?? null,
            mask: acct.mask ?? null,
            isoCurrencyCode: acct.balances.iso_currency_code ?? null,
          },
        });
      }

      // ── 2. Auto-create / update Debts and Assets ─────────────────
      for (const acct of accountsRes.data.accounts) {
        const balance = acct.balances.current ?? 0;

        if (acct.type === 'credit' || acct.type === 'loan') {
          const debtType = acct.subtype === 'mortgage' ? 'mortgage'
            : acct.subtype === 'auto' ? 'auto'
            : acct.subtype === 'student' ? 'student'
            : acct.type === 'credit' ? 'credit_card'
            : 'other';

          const existing = await prisma.debt.findFirst({
            where: { userId, plaidAccountId: acct.account_id },
          });
          if (existing) {
            await prisma.debt.update({
              where: { id: existing.id },
              data: { balance: Math.abs(balance) },
            });
          } else {
            await prisma.debt.create({
              data: {
                userId,
                name: acct.name,
                balance: Math.abs(balance),
                originalBalance: Math.abs(balance),
                interestRate: 0,
                minimumPayment: 0,
                type: debtType,
                linkedAccount: acct.name,
                plaidAccountId: acct.account_id,
              },
            });
          }
        } else if (['depository', 'investment', 'brokerage'].includes(acct.type)) {
          const assetType = acct.subtype === 'checking' ? 'checking'
            : acct.subtype === 'savings' ? 'savings'
            : (acct.type === 'investment' || acct.type === 'brokerage') ? 'investment'
            : 'other';

          const assetValue = Math.max(0, balance);
          const existing = await prisma.asset.findFirst({
            where: { userId, plaidAccountId: acct.account_id },
          });
          if (existing) {
            await prisma.asset.update({
              where: { id: existing.id },
              data: { value: assetValue },
            });
          } else {
            await prisma.asset.create({
              data: {
                userId,
                name: acct.name,
                value: assetValue,
                type: assetType,
                plaidAccountId: acct.account_id,
              },
            });
          }
        }
      }

      // ── 3. Sync transactions ──────────────────────────────────────
      let hasMore = true;
      let cursor = item.cursor || undefined;

      while (hasMore) {
        const response = await plaidClient.transactionsSync({
          access_token: decryptedToken, cursor, count: 100,
        });
        const { added, modified, removed, next_cursor, has_more } = response.data;

        for (const txn of added) {
          const existing = await prisma.transaction.findFirst({
            where: { userId, plaidTransactionId: txn.transaction_id },
          });
          if (!existing) {
            await prisma.transaction.create({
              data: {
                userId,
                date: new Date(txn.date || new Date().toISOString().split('T')[0]),
                description: txn.merchant_name || txn.name || 'Unknown',
                originalDescription: txn.name || null,
                amount: -(txn.amount || 0),
                category: mapPlaidCategory(txn),
                account: accountIdToName[txn.account_id] ?? item.institutionName ?? 'Plaid',
                plaidTransactionId: txn.transaction_id,
                autoMatched: true,
              },
            });
            totalAdded++;
          }
        }

        for (const txn of modified) {
          await prisma.transaction.updateMany({
            where: { userId, plaidTransactionId: txn.transaction_id },
            data: {
              description: txn.merchant_name || txn.name || 'Unknown',
              amount: -(txn.amount || 0),
              category: mapPlaidCategory(txn),
            },
          });
          totalModified++;
        }

        for (const txn of removed) {
          if (txn.transaction_id) {
            await prisma.transaction.deleteMany({
              where: { userId, plaidTransactionId: txn.transaction_id },
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

    // ── 4. Auto-snapshot net worth ────────────────────────────────
    const [assets, debts] = await Promise.all([
      prisma.asset.findMany({ where: { userId } }),
      prisma.debt.findMany({ where: { userId, status: 'active' } }),
    ]);
    const totalAssets = assets.reduce((sum, a) => sum + Number(a.value), 0);
    const totalLiabilities = debts.reduce((sum, d) => sum + Number(d.balance), 0);
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const existingSnapshot = await prisma.netWorthSnapshot.findFirst({
      where: { userId, date: today },
    });
    if (existingSnapshot) {
      await prisma.netWorthSnapshot.update({
        where: { id: existingSnapshot.id },
        data: {
          assets: totalAssets,
          liabilities: totalLiabilities,
          netWorth: totalAssets - totalLiabilities,
        },
      });
    } else {
      await prisma.netWorthSnapshot.create({
        data: {
          userId,
          date: today,
          assets: totalAssets,
          liabilities: totalLiabilities,
          netWorth: totalAssets - totalLiabilities,
        },
      });
    }

    return NextResponse.json({
      success: true,
      added: totalAdded,
      modified: totalModified,
      removed: totalRemoved,
    });
  } catch (err: any) {
    console.error('Plaid sync error:', err.message);
    return NextResponse.json({ error: 'Failed to sync' }, { status: 500 });
  }
}
