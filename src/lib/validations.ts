import { z } from 'zod';

// ─── Transactions ───────────────────────────

export const transactionCreateSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  description: z.string().min(1).max(500),
  originalDescription: z.string().max(500).optional(),
  amount: z.number().finite(),
  category: z.string().max(100).default('Uncategorized'),
  account: z.string().max(100).default('Default'),
  autoMatched: z.boolean().default(false),
  flagged: z.boolean().default(false),
  transferPairId: z.string().max(100).optional(),
  returnPairId: z.string().max(100).optional(),
  note: z.string().max(1000).optional(),
});

export const transactionUpdateSchema = transactionCreateSchema.partial();

export const transactionBulkCreateSchema = z.object({
  transactions: z.array(transactionCreateSchema).min(1).max(5000),
  importRecord: z.object({
    filename: z.string().max(255),
    sourceType: z.enum(['csv', 'pdf', 'json']).default('csv'),
  }).optional(),
});

export const transactionBulkUpdateSchema = z.object({
  ids: z.array(z.string()).min(1).max(500),
  update: transactionUpdateSchema,
});

export const transactionBulkDeleteSchema = z.object({
  ids: z.array(z.string()).min(1).max(500),
});

export const transactionQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(5000).default(50),
  sort: z.enum(['date', 'amount', 'description', 'category']).default('date'),
  order: z.enum(['asc', 'desc']).default('desc'),
  category: z.string().optional(),
  account: z.string().optional(),
  search: z.string().max(200).optional(),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  amountMin: z.coerce.number().optional(),
  amountMax: z.coerce.number().optional(),
  flagged: z.coerce.boolean().optional(),
});

// ─── Categories ─────────────────────────────

export const categoryCreateSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['income', 'expense', 'system']).default('expense'),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  sortOrder: z.number().int().min(0).default(0),
});

export const categoryUpdateSchema = categoryCreateSchema.partial();

// ─── Merchant Rules ─────────────────────────

export const merchantRuleSchema = z.object({
  merchant: z.string().min(1).max(100),
  category: z.string().min(1).max(100),
});

export const merchantRuleBulkSchema = z.object({
  rules: z.array(merchantRuleSchema).min(1).max(500),
});

// ─── Savings Goals ──────────────────────────

export const goalCreateSchema = z.object({
  name: z.string().min(1).max(200),
  targetAmount: z.number().positive().finite(),
  currentAmount: z.number().min(0).finite().default(0),
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  linkedAccount: z.string().max(100).optional(),
  icon: z.string().max(50).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  priorityOrder: z.number().int().min(0).default(0),
});

export const goalUpdateSchema = goalCreateSchema.partial().extend({
  status: z.enum(['active', 'completed', 'paused']).optional(),
});

export const contributionCreateSchema = z.object({
  amount: z.number().positive().finite(),
  note: z.string().max(500).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

// ─── Debts ──────────────────────────────────

export const debtCreateSchema = z.object({
  name: z.string().min(1).max(200),
  balance: z.number().positive().finite(),
  originalBalance: z.number().positive().finite(),
  interestRate: z.number().min(0).max(100).finite(),
  minimumPayment: z.number().min(0).finite(),
  extraPayment: z.number().min(0).finite().default(0),
  dueDay: z.number().int().min(1).max(31).default(1),
  type: z.enum(['mortgage', 'auto', 'student', 'credit_card', 'personal', 'other']).default('other'),
  linkedAccount: z.string().max(100).optional(),
});

export const debtUpdateSchema = debtCreateSchema.partial().extend({
  status: z.enum(['active', 'paid_off']).optional(),
});

// ─── Assets ─────────────────────────────────

export const assetCreateSchema = z.object({
  name: z.string().min(1).max(200),
  value: z.number().finite(),
  type: z.enum(['checking', 'savings', 'investment', 'retirement', 'property', 'vehicle', 'other']).default('other'),
});

export const assetUpdateSchema = assetCreateSchema.partial();

// ─── Net Worth Snapshots ────────────────────

export const snapshotCreateSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  assets: z.number().finite(),
  liabilities: z.number().finite(),
  netWorth: z.number().finite(),
  breakdown: z.record(z.any()).optional(),
});

// ─── Budgets ────────────────────────────────

export const budgetCreateSchema = z.object({
  category: z.string().min(1).max(100),
  monthlyLimit: z.number().positive().finite(),
  rollover: z.boolean().default(false),
});

export const budgetUpdateSchema = budgetCreateSchema.partial();

export const budgetBulkSchema = z.object({
  budgets: z.array(budgetCreateSchema).min(1).max(100),
});

// ─── Calendar Events ────────────────────────

export const calendarEventCreateSchema = z.object({
  title: z.string().min(1).max(200),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amount: z.number().finite().optional(),
  type: z.enum(['bill', 'payday', 'reminder', 'custom']).default('bill'),
  recurring: z.enum(['monthly', 'biweekly', 'weekly', 'yearly']).optional(),
  category: z.string().max(100).optional(),
});

export const calendarEventUpdateSchema = calendarEventCreateSchema.partial();

// ─── Subscriptions ──────────────────────────

export const subscriptionCreateSchema = z.object({
  name: z.string().min(1).max(200),
  amount: z.number().positive().finite(),
  frequency: z.enum(['monthly', 'yearly', 'weekly']).default('monthly'),
  category: z.string().max(100).default('Subscriptions'),
  nextBillDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  isActive: z.boolean().default(true),
});

export const subscriptionUpdateSchema = subscriptionCreateSchema.partial();

// ─── Settings ───────────────────────────────

export const settingsUpdateSchema = z.object({
  darkMode: z.boolean().optional(),
  currency: z.string().max(10).optional(),
  locale: z.string().max(20).optional(),
  dashPeriod: z.string().max(20).optional(),
  sidebarOpen: z.boolean().optional(),
  budgetRollover: z.boolean().optional(),
});
