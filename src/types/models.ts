// ─── Transactions ───────────────────────────

export interface Transaction {
  id: string;
  date: string; // YYYY-MM-DD
  description: string;
  originalDescription?: string | null;
  amount: number;
  category: string;
  account: string;
  autoMatched: boolean;
  flagged: boolean;
  transferPairId?: string | null;
  returnPairId?: string | null;
  importRecordId?: string | null;
  note?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TransactionQuery {
  page?: number;
  limit?: number;
  sort?: 'date' | 'amount' | 'description' | 'category' | 'account';
  order?: 'asc' | 'desc';
  category?: string;
  account?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  amountMin?: number;
  amountMax?: number;
  flagged?: boolean;
}

export interface PaginatedResponse<T> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  [key: string]: T[] | any;
}

// ─── Categories ─────────────────────────────

export interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense' | 'system';
  color?: string | null;
  sortOrder: number;
  isDefault: boolean;
}

// ─── Goals ──────────────────────────────────

export interface GoalContribution {
  id: string;
  amount: number;
  note?: string | null;
  date: string;
}

export interface SavingsGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline?: string | null;
  linkedAccount?: string | null;
  icon?: string | null;
  color?: string | null;
  priority: 'low' | 'medium' | 'high';
  priorityOrder: number;
  status: 'active' | 'completed' | 'paused';
  contributions: GoalContribution[];
  createdAt: string;
}

// ─── Debts ──────────────────────────────────

export interface Debt {
  id: string;
  name: string;
  balance: number;
  originalBalance: number;
  interestRate: number;
  minimumPayment: number;
  extraPayment: number;
  dueDay: number;
  type: 'mortgage' | 'auto' | 'student' | 'credit_card' | 'personal' | 'other';
  linkedAccount?: string | null;
  sortOrder: number;
  status: 'active' | 'paid_off';
  createdAt: string;
}

// ─── Assets & Net Worth ─────────────────────

export interface Asset {
  id: string;
  name: string;
  value: number;
  type: 'checking' | 'savings' | 'investment' | 'retirement' | 'property' | 'vehicle' | 'other';
  createdAt: string;
}

export interface NetWorthSnapshot {
  id: string;
  date: string;
  assets: number;
  liabilities: number;
  netWorth: number;
  breakdown?: Record<string, any> | null;
}

// ─── Budgets ────────────────────────────────

export interface Budget {
  id: string;
  category: string;
  monthlyLimit: number;
  rollover: boolean;
}

// ─── Calendar ───────────────────────────────

export interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  amount?: number | null;
  type: 'bill' | 'payday' | 'reminder' | 'custom';
  recurring?: 'monthly' | 'biweekly' | 'weekly' | 'yearly' | null;
  category?: string | null;
}

// ─── Subscriptions ──────────────────────────

export interface Subscription {
  id: string;
  name: string;
  amount: number;
  frequency: 'monthly' | 'yearly' | 'weekly';
  category: string;
  nextBillDate?: string | null;
  isAutoDetected: boolean;
  isActive: boolean;
  cancelStatus: 'active' | 'planned' | 'marked' | 'cancelled';
}

// ─── Dashboard ──────────────────────────────

export interface DashboardData {
  overview: {
    totalTransactions: number;
    monthlyIncome: number;
    monthlyExpenses: number;
    netSavings: number;
    totalAssets: number;
    totalDebts: number;
    netWorth: number;
  };
  categorySpending: Record<string, number>;
  goals: {
    name: string;
    targetAmount: number;
    currentAmount: number;
    progress: number;
  }[];
  debts: {
    name: string;
    balance: number;
    originalBalance: number;
    progress: number;
  }[];
  recentNetWorth: {
    date: string;
    netWorth: number;
  }[];
}

// ─── Settings ───────────────────────────────

export interface UserSettings {
  id: string;
  darkMode: boolean;
  currency: string;
  locale: string;
  dashPeriod: string;
  sidebarOpen: boolean;
  budgetRollover: boolean;
}

// ─── Import ─────────────────────────────────

export interface ImportRecord {
  id: string;
  filename: string;
  sourceType: 'csv' | 'pdf' | 'json';
  count: number;
  dateRange?: string | null;
  importedAt: string;
  transactionCount: number;
}
