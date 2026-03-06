import { NextResponse } from 'next/server';
import { requireAuthWithLimit } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/subscriptions/detect
 * Scans recent transactions for recurring same-amount charges.
 * Returns candidates that aren't already tracked as subscriptions.
 */
export async function POST() {
  const auth = await requireAuthWithLimit('api:write');
  if ('error' in auth) return auth.error;
  const { userId } = auth;

  try {
    // Get last 6 months of transactions
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const transactions = await prisma.transaction.findMany({
      where: {
        userId,
        amount: { lt: 0 }, // expenses only
        date: { gte: sixMonthsAgo },
      },
      orderBy: { date: 'asc' },
      select: { description: true, amount: true, date: true, category: true },
    });

    // Get existing subscriptions to exclude
    const existing = await prisma.subscription.findMany({
      where: { userId },
      select: { name: true },
    });
    const existingNames = new Set(existing.map(s => s.name.toUpperCase()));

    // Group by merchant + amount (exact match)
    const groups: Record<string, {
      description: string;
      amount: number;
      category: string;
      dates: Date[];
    }> = {};

    for (const t of transactions) {
      // Normalize merchant name: uppercase, first 20 chars, strip numbers
      const merchant = t.description
        .toUpperCase()
        .replace(/\d{4,}/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 25);

      const amt = Math.abs(Number(t.amount));
      const key = `${merchant}|${amt.toFixed(2)}`;

      if (!groups[key]) {
        groups[key] = {
          description: t.description,
          amount: amt,
          category: t.category,
          dates: [],
        };
      }
      groups[key].dates.push(t.date);
    }

    // Filter for recurring patterns (3+ occurrences, roughly monthly/weekly/yearly)
    const candidates: {
      name: string;
      amount: number;
      frequency: 'monthly' | 'yearly' | 'weekly';
      category: string;
      occurrences: number;
      confidence: number;
    }[] = [];

    for (const [, group] of Object.entries(groups)) {
      if (group.dates.length < 3) continue;

      // Skip if already tracked
      const nameUp = group.description.toUpperCase().slice(0, 25);
      if (existingNames.has(nameUp)) continue;

      // Calculate average days between charges
      const sorted = group.dates.map(d => new Date(d).getTime()).sort((a, b) => a - b);
      const gaps: number[] = [];
      for (let i = 1; i < sorted.length; i++) {
        gaps.push((sorted[i] - sorted[i - 1]) / 86400000);
      }
      const avgGap = gaps.reduce((s, g) => s + g, 0) / gaps.length;
      const gapStdDev = Math.sqrt(gaps.reduce((s, g) => s + Math.pow(g - avgGap, 2), 0) / gaps.length);

      // Classify frequency
      let frequency: 'monthly' | 'yearly' | 'weekly';
      let confidence = 0;

      if (avgGap >= 5 && avgGap <= 10) {
        frequency = 'weekly';
        confidence = Math.max(0, 1 - gapStdDev / 3);
      } else if (avgGap >= 25 && avgGap <= 35) {
        frequency = 'monthly';
        confidence = Math.max(0, 1 - gapStdDev / 7);
      } else if (avgGap >= 350 && avgGap <= 380) {
        frequency = 'yearly';
        confidence = Math.max(0, 1 - gapStdDev / 15);
      } else {
        continue; // Doesn't match any frequency
      }

      // Only include if confidence > 0.5
      if (confidence < 0.5) continue;

      // Clean up the name
      const name = group.description
        .replace(/\s+\d{4,}$/, '')
        .replace(/\s+#\w+$/, '')
        .trim();

      candidates.push({
        name,
        amount: group.amount,
        frequency,
        category: group.category,
        occurrences: group.dates.length,
        confidence: Math.round(confidence * 100),
      });
    }

    // Sort by confidence
    candidates.sort((a, b) => b.confidence - a.confidence);

    return NextResponse.json({ candidates });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
