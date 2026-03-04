import { prisma } from '@/lib/prisma';

// All categories from the original app, properly typed
const DEFAULT_CATEGORIES = [
  // Expense
  { name: 'Housing', type: 'expense', color: '#4F6D7A' },
  { name: 'Transportation', type: 'expense', color: '#C0D6DF' },
  { name: 'Groceries', type: 'expense', color: '#16A34A' },
  { name: 'Restaurants', type: 'expense', color: '#EA580C' },
  { name: 'Food & Dining', type: 'expense', color: '#DB6C35' },
  { name: 'Subscriptions', type: 'expense', color: '#8B5CF6' },
  { name: 'Utilities', type: 'expense', color: '#059669' },
  { name: 'Insurance', type: 'expense', color: '#0284C7' },
  { name: 'Shopping', type: 'expense', color: '#E11D48' },
  { name: 'Entertainment', type: 'expense', color: '#D946EF' },
  { name: 'Healthcare', type: 'expense', color: '#DC2626' },
  { name: 'Personal Care', type: 'expense', color: '#F472B6' },
  { name: 'Education', type: 'expense', color: '#4338CA' },
  { name: 'Gifts & Donations', type: 'expense', color: '#C026D3' },
  { name: 'Travel', type: 'expense', color: '#0891B2' },
  { name: 'Fees & Charges', type: 'expense', color: '#78716C' },
  { name: 'Other Expenses', type: 'expense', color: '#A3A3A3' },
  // Income
  { name: 'Income', type: 'income', color: '#16A34A' },
  { name: 'Salary', type: 'income', color: '#15803D' },
  { name: 'Freelance', type: 'income', color: '#22C55E' },
  { name: 'Investments', type: 'income', color: '#059669' },
  { name: 'Rental Income', type: 'income', color: '#0D9488' },
  { name: 'Side Hustle', type: 'income', color: '#10B981' },
  { name: 'Other Income', type: 'income', color: '#34D399' },
  // System
  { name: 'Transfers', type: 'system', color: '#8B5CF6' },
  { name: 'Debt Payments', type: 'system', color: '#F59E0B' },
  { name: 'Savings', type: 'system', color: '#0EA5E9' },
  { name: 'Refunds', type: 'system', color: '#6366F1' },
  { name: 'Returns', type: 'system', color: '#818CF8' },
  { name: 'Uncategorized', type: 'system', color: '#9CA3AF' },
];

export async function seedUserDefaults(userId: string) {
  // Create default categories
  await prisma.category.createMany({
    data: DEFAULT_CATEGORIES.map((cat, i) => ({
      userId,
      name: cat.name,
      type: cat.type,
      color: cat.color,
      sortOrder: i,
      isDefault: true,
    })),
    skipDuplicates: true,
  });

  // Create default user settings
  await prisma.userSettings.upsert({
    where: { userId },
    create: { userId },
    update: {},
  });
}
