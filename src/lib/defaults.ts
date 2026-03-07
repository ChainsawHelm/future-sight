import { prisma } from '@/lib/prisma';

// All categories from the original app, properly typed
const DEFAULT_CATEGORIES = [
  // Expense
  { name: 'Housing', type: 'expense', color: '#4F6D7A' },
  { name: 'Mortgage', type: 'expense', color: '#3D5A6E' },
  { name: 'Transportation', type: 'expense', color: '#C0D6DF' },
  { name: 'Gas', type: 'expense', color: '#A8C4D0' },
  { name: 'Groceries', type: 'expense', color: '#16A34A' },
  { name: 'Restaurants', type: 'expense', color: '#EA580C' },
  { name: 'Coffee', type: 'expense', color: '#92400E' },
  { name: 'Food & Dining', type: 'expense', color: '#DB6C35' },
  { name: 'Alcohol & Tobacco', type: 'expense', color: '#9F1239' },
  { name: 'Subscriptions', type: 'expense', color: '#8B5CF6' },
  { name: 'Utilities', type: 'expense', color: '#059669' },
  { name: 'Phone', type: 'expense', color: '#047857' },
  { name: 'Insurance', type: 'expense', color: '#0284C7' },
  { name: 'Shopping', type: 'expense', color: '#E11D48' },
  { name: 'Clothing', type: 'expense', color: '#BE185D' },
  { name: 'Electronics', type: 'expense', color: '#7C3AED' },
  { name: 'Entertainment', type: 'expense', color: '#D946EF' },
  { name: 'Healthcare', type: 'expense', color: '#DC2626' },
  { name: 'Personal Care', type: 'expense', color: '#F472B6' },
  { name: 'Fitness', type: 'expense', color: '#F97316' },
  { name: 'Education', type: 'expense', color: '#4338CA' },
  { name: 'Gifts', type: 'expense', color: '#C026D3' },
  { name: 'Gifts & Donations', type: 'expense', color: '#A21CAF' },
  { name: 'Travel', type: 'expense', color: '#0891B2' },
  { name: 'Home Maintenance', type: 'expense', color: '#B45309' },
  { name: 'Shipping', type: 'expense', color: '#94A3B8' },
  { name: 'Storage', type: 'expense', color: '#78716C' },
  { name: 'Fees & Charges', type: 'expense', color: '#78716C' },
  { name: 'Interest & Fees', type: 'expense', color: '#6B7280' },
  { name: 'ATM & Fees', type: 'expense', color: '#64748B' },
  { name: 'Taxes', type: 'expense', color: '#475569' },
  { name: 'Other Expenses', type: 'expense', color: '#A3A3A3' },
  // Income
  { name: 'Income', type: 'income', color: '#16A34A' },
  { name: 'Salary', type: 'income', color: '#15803D' },
  { name: 'Freelance', type: 'income', color: '#22C55E' },
  { name: 'Investments', type: 'income', color: '#059669' },
  { name: 'Rental Income', type: 'income', color: '#0D9488' },
  { name: 'Interest', type: 'income', color: '#0E7490' },
  { name: 'HSA Contribution', type: 'income', color: '#0369A1' },
  { name: 'Side Hustle', type: 'income', color: '#10B981' },
  { name: 'Other Income', type: 'income', color: '#34D399' },
  // System
  { name: 'Transfers', type: 'system', color: '#8B5CF6' },
  { name: 'Credit Card Payment', type: 'system', color: '#6D28D9' },
  { name: 'ATM', type: 'system', color: '#7C3AED' },
  { name: 'Debt Payments', type: 'system', color: '#F59E0B' },
  { name: 'Savings', type: 'system', color: '#0EA5E9' },
  { name: 'Refunds', type: 'system', color: '#6366F1' },
  { name: 'Returns', type: 'system', color: '#818CF8' },
  { name: 'Check', type: 'system', color: '#A78BFA' },
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
