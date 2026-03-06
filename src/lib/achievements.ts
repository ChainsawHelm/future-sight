// ═══════════════════════════════════════════════════════════════════════════════
// FUTURE SIGHT — Achievement System (200+ achievements)
// ═══════════════════════════════════════════════════════════════════════════════

export interface AchievementDef {
  key: string;
  category: 'onboarding' | 'transactions' | 'savings' | 'debt' | 'budget' | 'networth' | 'streaks' | 'milestones';
  title: string;
  description: string;
  ascii: string;
  tier: 1 | 2 | 3 | 4 | 5; // bronze, silver, gold, platinum, diamond
}

export interface AchievementContext {
  // Transactions
  totalTxns: number;
  totalIncomeTxns: number;
  totalExpenseTxns: number;
  uniqueCategories: number;
  uniqueAccounts: number;
  oldestTxnDays: number;
  // Savings goals
  totalGoals: number;
  completedGoals: number;
  totalSaved: number;
  largestGoal: number;
  // Debts
  totalDebts: number;
  paidOffDebts: number;
  totalDebtBalance: number;
  totalDebtOriginal: number;
  debtPayoffPercent: number;
  isDebtFree: boolean;
  hasDebts: boolean;
  // Budget
  budgetCategories: number;
  // Monthly budget compliance — key: "2026-03", value: { onBudget: number, total: number }
  monthlyBudgetCompliance: Record<string, { onBudget: number; total: number; allOnBudget: boolean }>;
  consecutiveBudgetMonths: number;
  // Financials
  monthlyIncome: number;
  monthlyExpenses: number;
  netSavings: number;
  savingsRate: number;
  totalAssets: number;
  netWorth: number;
  assetTypes: number;
  // Streaks
  streak: number;
  longestStreak: number;
  // Time-based
  accountAgeDays: number;
  totalMonthsTracked: number;
}

// ─── ASCII Art Library ────────────────────────────────────────────────────────

const ART = {
  download:   '  ┌───┐ \n  │ ▼ │ \n  └─┬─┘ \n ───┴───',
  stack_sm:   ' ┌───┐  \n │ # │  \n └───┘  ',
  stack_md:   ' ╔═══╗  \n ║ # ║  \n ╚═══╝  ',
  stack_lg:   ' ╔═════╗\n ║ ### ║\n ╚═════╝',
  trophy_sm:  '   ╱╲   \n  ╱  ╲  \n  ╲  ╱  \n   ╲╱   ',
  trophy_md:  '  ╱──╲  \n │ ★ │  \n  ╲──╱  \n  ─┴─   ',
  trophy_lg:  '  ╱────╲\n │ ★★★ │\n  ╲────╱\n  ──┴──  ',
  dollar:     '   ┌─┐  \n   │$│  \n ──┤ ├──\n   │+│  \n   └─┘  ',
  piggy:      '  ╭───╮ \n  │ $ │ \n ╭┤   ├╮\n │╰───╯│\n ╰─────╯',
  vault:      ' ┌─────┐\n │ $$$ │\n │ ▓▓▓ │\n │ $$$ │\n └─────┘',
  diamond:    '   ◆    \n  ◆◆◆   \n ◆◆◆◆◆  \n  ◆◆◆   \n   ◆    ',
  chain_brk:  ' ─╮ ╭─  \n  │X│   \n ─╯ ╰─  ',
  zero:       '  ╔═══╗ \n  ║ 0 ║ \n  ╚═╤═╝ \n ───┴───\n  FREE! ',
  target:     '    ◎   \n   ╱│╲  \n  ╱ │ ╲ \n ‾‾‾‾‾‾‾',
  chart_bar:  ' ┌──┬──┐\n │▓▓│░░│\n │▓▓│░░│\n │▓▓│  │\n └──┴──┘',
  chart_up:   '      ╱ \n    ╱   \n  ╱     \n ╱   +$ \n ───────',
  grid_7:     ' ╔═╦═╦═╗\n ║█║█║█║\n ╠═╬═╬═╣\n ║█║█║█║\n ╚═╩═╩═╝',
  calendar:   ' ┌─┬─┬─┐\n │░│░│░│\n ├─┼─┼─┤\n │░│ │░│\n └─┴─┴─┘',
  shield:     '  ╱──╲  \n │ ✓ │  \n │   │  \n  ╲  ╱  \n   ╲╱   ',
  crown:      '  ╱╲╱╲  \n ╱    ╲ \n │ ★★ │ \n └────┘ ',
  rocket:     '   ╱╲   \n  │  │  \n  │  │  \n ╱│  │╲ \n  ╰──╯  ',
  medal:      '  ╭──╮  \n  │★★│  \n  ╰──╯  \n  ╱  ╲  \n ╱    ╲ ',
  mountain:   '     ╱╲ \n   ╱╱  ╲\n  ╱╱  ╱╲╲\n ╱   ╱  ╲╲\n ────────',
  lightning:  '  ╲╲    \n   ╲╲   \n  ══╗   \n   ╱╱   \n  ╱╱    ',
  lock_open:  '  ┌──┐  \n  │  │  \n ┌┘  └┐ \n │ OK │ \n └────┘ ',
  infinity:   '  ╭──╮  \n ╱    ╲ \n ╲    ╱ \n  ╰──╯  ',
  percent:    ' ╔╗  ╱  \n ╚╝ ╱   \n   ╱    \n  ╱ ╔╗  \n ╱  ╚╝  ',
  star:       '    ★    \n  ╱ ★ ╲  \n ★ ★ ★ ★ \n  ╲ ★ ╱  \n    ★    ',
  clock:      '  ╭───╮ \n  │12 │ \n  │ │  │ \n  │ └─ │ \n  ╰───╯ ',
  gem:        '  ╱╲╱╲  \n ╱    ╲ \n ╲    ╱ \n  ╲╱╲╱  ',
};

// ─── Static Achievement Definitions ───────────────────────────────────────────

const STATIC_ACHIEVEMENTS: AchievementDef[] = [
  // ═══ ONBOARDING (10) ═══
  { key: 'first_txn', category: 'onboarding', title: 'FIRST_BYTE', description: 'Record your first transaction', ascii: ART.download, tier: 1 },
  { key: 'first_import', category: 'onboarding', title: 'DATA_INTAKE', description: 'Import transactions from a file', ascii: ART.download, tier: 1 },
  { key: 'first_goal', category: 'onboarding', title: 'GOAL_INIT', description: 'Create your first savings goal', ascii: ART.target, tier: 1 },
  { key: 'first_debt', category: 'onboarding', title: 'DEBT_LOGGED', description: 'Track your first debt', ascii: ART.chain_brk, tier: 1 },
  { key: 'first_budget', category: 'onboarding', title: 'BUDGET_SET', description: 'Set your first budget category', ascii: ART.chart_bar, tier: 1 },
  { key: 'first_asset', category: 'onboarding', title: 'ASSET_REG', description: 'Register your first asset', ascii: ART.chart_up, tier: 1 },
  { key: 'five_categories', category: 'onboarding', title: 'CATEGORIZED', description: 'Use 5 different spending categories', ascii: ART.chart_bar, tier: 1 },
  { key: 'two_accounts', category: 'onboarding', title: 'MULTI_ACCT', description: 'Track transactions from 2+ accounts', ascii: ART.stack_md, tier: 1 },
  { key: 'ten_categories', category: 'onboarding', title: 'TAXONOMY_PRO', description: 'Use 10 different categories', ascii: ART.chart_bar, tier: 2 },
  { key: 'five_accounts', category: 'onboarding', title: 'FULL_COVERAGE', description: 'Track 5+ accounts', ascii: ART.stack_lg, tier: 2 },

  // ═══ TRANSACTIONS (25) ═══
  { key: 'txn_1', category: 'transactions', title: 'HELLO_WORLD', description: 'Log 1 transaction', ascii: ART.stack_sm, tier: 1 },
  { key: 'txn_10', category: 'transactions', title: 'DOUBLE_DIGIT', description: 'Log 10 transactions', ascii: ART.stack_sm, tier: 1 },
  { key: 'txn_25', category: 'transactions', title: 'QUARTER_CENT', description: 'Log 25 transactions', ascii: ART.stack_sm, tier: 1 },
  { key: 'txn_50', category: 'transactions', title: 'HALF_CENTURY', description: 'Log 50 transactions', ascii: ART.stack_md, tier: 1 },
  { key: 'txn_100', category: 'transactions', title: 'CENTURY_LOG', description: 'Log 100 transactions', ascii: ART.stack_md, tier: 2 },
  { key: 'txn_250', category: 'transactions', title: 'DATA_STREAM', description: 'Log 250 transactions', ascii: ART.stack_md, tier: 2 },
  { key: 'txn_500', category: 'transactions', title: 'HALF_K', description: 'Log 500 transactions', ascii: ART.stack_lg, tier: 2 },
  { key: 'txn_750', category: 'transactions', title: 'THREE_QUARTERS', description: 'Log 750 transactions', ascii: ART.stack_lg, tier: 3 },
  { key: 'txn_1000', category: 'transactions', title: 'KILOBYTE', description: 'Log 1,000 transactions', ascii: ART.trophy_md, tier: 3 },
  { key: 'txn_2500', category: 'transactions', title: 'MASS_DATA', description: 'Log 2,500 transactions', ascii: ART.trophy_md, tier: 3 },
  { key: 'txn_5000', category: 'transactions', title: 'BIG_DATA', description: 'Log 5,000 transactions', ascii: ART.trophy_lg, tier: 4 },
  { key: 'txn_10000', category: 'transactions', title: 'MEGA_LOG', description: 'Log 10,000 transactions', ascii: ART.trophy_lg, tier: 4 },
  { key: 'txn_25000', category: 'transactions', title: 'DATA_HOARDER', description: 'Log 25,000 transactions', ascii: ART.crown, tier: 5 },
  { key: 'txn_50000', category: 'transactions', title: 'ARCHIVIST', description: 'Log 50,000 transactions', ascii: ART.crown, tier: 5 },
  { key: 'income_10', category: 'transactions', title: 'INCOME_STREAM', description: 'Log 10 income transactions', ascii: ART.dollar, tier: 1 },
  { key: 'income_50', category: 'transactions', title: 'REVENUE_FLOW', description: 'Log 50 income transactions', ascii: ART.dollar, tier: 2 },
  { key: 'income_100', category: 'transactions', title: 'CASH_RIVER', description: 'Log 100 income transactions', ascii: ART.dollar, tier: 2 },
  { key: 'income_500', category: 'transactions', title: 'INCOME_TORRENT', description: 'Log 500 income transactions', ascii: ART.dollar, tier: 3 },
  { key: 'expense_10', category: 'transactions', title: 'SPENDING_LOG', description: 'Log 10 expense transactions', ascii: ART.percent, tier: 1 },
  { key: 'expense_50', category: 'transactions', title: 'LEDGER_KEEPER', description: 'Log 50 expense transactions', ascii: ART.percent, tier: 1 },
  { key: 'expense_100', category: 'transactions', title: 'EXPENSE_TRACKER', description: 'Log 100 expenses', ascii: ART.percent, tier: 2 },
  { key: 'expense_500', category: 'transactions', title: 'FULL_AUDIT', description: 'Log 500 expenses', ascii: ART.percent, tier: 3 },
  { key: 'expense_1000', category: 'transactions', title: 'FORENSIC_ACCT', description: 'Log 1,000 expenses', ascii: ART.percent, tier: 3 },
  { key: 'expense_5000', category: 'transactions', title: 'MASTER_LEDGER', description: 'Log 5,000 expenses', ascii: ART.percent, tier: 4 },
  { key: 'expense_10000', category: 'transactions', title: 'EXPENSE_ORACLE', description: 'Log 10,000 expenses', ascii: ART.percent, tier: 5 },

  // ═══ SAVINGS GOALS (30) ═══
  { key: 'saved_1', category: 'savings', title: 'FIRST_DOLLAR', description: 'Save your first $1', ascii: ART.piggy, tier: 1 },
  { key: 'saved_5', category: 'savings', title: 'FIVER', description: 'Save $5 total', ascii: ART.piggy, tier: 1 },
  { key: 'saved_10', category: 'savings', title: 'TENNER', description: 'Save $10 total', ascii: ART.piggy, tier: 1 },
  { key: 'saved_25', category: 'savings', title: 'QUARTER_STASH', description: 'Save $25 total', ascii: ART.piggy, tier: 1 },
  { key: 'saved_50', category: 'savings', title: 'HALF_HUNDRED', description: 'Save $50 total', ascii: ART.piggy, tier: 1 },
  { key: 'saved_100', category: 'savings', title: 'HUNDRED_STACK', description: 'Save $100 total', ascii: ART.dollar, tier: 1 },
  { key: 'saved_250', category: 'savings', title: 'NEST_EGG', description: 'Save $250 total', ascii: ART.dollar, tier: 1 },
  { key: 'saved_500', category: 'savings', title: 'HALF_GRAND', description: 'Save $500 total', ascii: ART.dollar, tier: 2 },
  { key: 'saved_1000', category: 'savings', title: 'GRAND_SAVER', description: 'Save $1,000 total', ascii: ART.vault, tier: 2 },
  { key: 'saved_2500', category: 'savings', title: 'STASH_BUILDER', description: 'Save $2,500 total', ascii: ART.vault, tier: 2 },
  { key: 'saved_5000', category: 'savings', title: 'FIVE_GRAND', description: 'Save $5,000 total', ascii: ART.vault, tier: 3 },
  { key: 'saved_10000', category: 'savings', title: 'TEN_K_CLUB', description: 'Save $10,000 total', ascii: ART.trophy_md, tier: 3 },
  { key: 'saved_25000', category: 'savings', title: 'WEALTH_SEED', description: 'Save $25,000 total', ascii: ART.trophy_md, tier: 3 },
  { key: 'saved_50000', category: 'savings', title: 'FIFTY_GRAND', description: 'Save $50,000 total', ascii: ART.trophy_lg, tier: 4 },
  { key: 'saved_100000', category: 'savings', title: 'SIX_FIGURES', description: 'Save $100,000 total', ascii: ART.diamond, tier: 4 },
  { key: 'saved_250000', category: 'savings', title: 'QUARTER_MIL', description: 'Save $250,000 total', ascii: ART.diamond, tier: 4 },
  { key: 'saved_500000', category: 'savings', title: 'HALF_MILLION', description: 'Save $500,000 total', ascii: ART.crown, tier: 5 },
  { key: 'saved_1000000', category: 'savings', title: 'MILLIONAIRE', description: 'Save $1,000,000 total', ascii: ART.star, tier: 5 },
  { key: 'goal_1', category: 'savings', title: 'TARGET_HIT', description: 'Complete 1 savings goal', ascii: ART.target, tier: 1 },
  { key: 'goal_2', category: 'savings', title: 'DOUBLE_TAP', description: 'Complete 2 savings goals', ascii: ART.target, tier: 2 },
  { key: 'goal_3', category: 'savings', title: 'HAT_TRICK', description: 'Complete 3 savings goals', ascii: ART.target, tier: 2 },
  { key: 'goal_5', category: 'savings', title: 'HIGH_FIVE', description: 'Complete 5 savings goals', ascii: ART.trophy_sm, tier: 3 },
  { key: 'goal_10', category: 'savings', title: 'GOAL_MACHINE', description: 'Complete 10 savings goals', ascii: ART.trophy_md, tier: 3 },
  { key: 'goal_25', category: 'savings', title: 'GOAL_FACTORY', description: 'Complete 25 savings goals', ascii: ART.trophy_lg, tier: 4 },
  { key: 'savings_rate_10', category: 'savings', title: 'PENNY_DAEMON', description: 'Achieve a 10% savings rate', ascii: ART.percent, tier: 1 },
  { key: 'savings_rate_20', category: 'savings', title: 'FRUGAL_PROC', description: 'Achieve a 20% savings rate', ascii: ART.percent, tier: 2 },
  { key: 'savings_rate_30', category: 'savings', title: 'THRIFTY_CORE', description: 'Achieve a 30% savings rate', ascii: ART.percent, tier: 3 },
  { key: 'savings_rate_40', category: 'savings', title: 'HYPER_SAVER', description: 'Achieve a 40% savings rate', ascii: ART.percent, tier: 3 },
  { key: 'savings_rate_50', category: 'savings', title: 'HALF_KEEPER', description: 'Save 50% of your income', ascii: ART.percent, tier: 4 },
  { key: 'savings_rate_75', category: 'savings', title: 'EXTREME_SAVE', description: 'Save 75% of your income', ascii: ART.diamond, tier: 5 },

  // ═══ DEBT (30) ═══
  { key: 'debt_payoff_1pct', category: 'debt', title: 'FIRST_CHIP', description: 'Pay off 1% of total debt', ascii: ART.chain_brk, tier: 1 },
  { key: 'debt_payoff_5pct', category: 'debt', title: 'FIVE_PERCENT', description: 'Pay off 5% of total debt', ascii: ART.chain_brk, tier: 1 },
  { key: 'debt_payoff_10pct', category: 'debt', title: 'TEN_DOWN', description: 'Pay off 10% of total debt', ascii: ART.chain_brk, tier: 1 },
  { key: 'debt_payoff_15pct', category: 'debt', title: 'FIFTEEN_CLEAR', description: 'Pay off 15% of total debt', ascii: ART.chain_brk, tier: 2 },
  { key: 'debt_payoff_20pct', category: 'debt', title: 'FIFTH_FREE', description: 'Pay off 20% of total debt', ascii: ART.percent, tier: 2 },
  { key: 'debt_payoff_25pct', category: 'debt', title: 'QUARTER_GONE', description: 'Pay off 25% of total debt', ascii: ART.percent, tier: 2 },
  { key: 'debt_payoff_30pct', category: 'debt', title: 'THIRTY_PCT', description: 'Pay off 30% of total debt', ascii: ART.percent, tier: 2 },
  { key: 'debt_payoff_35pct', category: 'debt', title: 'OVER_A_THIRD', description: 'Pay off 35% of total debt', ascii: ART.shield, tier: 2 },
  { key: 'debt_payoff_40pct', category: 'debt', title: 'FORTY_CLEAR', description: 'Pay off 40% of total debt', ascii: ART.shield, tier: 3 },
  { key: 'debt_payoff_45pct', category: 'debt', title: 'ALMOST_HALF', description: 'Pay off 45% of total debt', ascii: ART.shield, tier: 3 },
  { key: 'debt_payoff_50pct', category: 'debt', title: 'HALFWAY_OUT', description: 'Pay off 50% of total debt', ascii: ART.trophy_sm, tier: 3 },
  { key: 'debt_payoff_55pct', category: 'debt', title: 'PAST_HALFWAY', description: 'Pay off 55% of total debt', ascii: ART.trophy_sm, tier: 3 },
  { key: 'debt_payoff_60pct', category: 'debt', title: 'SIXTY_FREE', description: 'Pay off 60% of total debt', ascii: ART.trophy_md, tier: 3 },
  { key: 'debt_payoff_65pct', category: 'debt', title: 'SIXTY_FIVE', description: 'Pay off 65% of total debt', ascii: ART.trophy_md, tier: 3 },
  { key: 'debt_payoff_70pct', category: 'debt', title: 'SEVENTY_PCT', description: 'Pay off 70% of total debt', ascii: ART.trophy_md, tier: 4 },
  { key: 'debt_payoff_75pct', category: 'debt', title: 'THREE_QUARTERS', description: 'Pay off 75% of total debt', ascii: ART.trophy_lg, tier: 4 },
  { key: 'debt_payoff_80pct', category: 'debt', title: 'EIGHTY_CLEAR', description: 'Pay off 80% of total debt', ascii: ART.trophy_lg, tier: 4 },
  { key: 'debt_payoff_85pct', category: 'debt', title: 'ALMOST_THERE', description: 'Pay off 85% of total debt', ascii: ART.diamond, tier: 4 },
  { key: 'debt_payoff_90pct', category: 'debt', title: 'NINETY_FREE', description: 'Pay off 90% of total debt', ascii: ART.diamond, tier: 4 },
  { key: 'debt_payoff_95pct', category: 'debt', title: 'SO_CLOSE', description: 'Pay off 95% of total debt', ascii: ART.diamond, tier: 5 },
  { key: 'debt_payoff_99pct', category: 'debt', title: 'LAST_PENNIES', description: 'Pay off 99% of total debt', ascii: ART.crown, tier: 5 },
  { key: 'debt_free', category: 'debt', title: 'ZERO_BALANCE', description: 'Pay off ALL debts completely', ascii: ART.zero, tier: 5 },
  { key: 'debt_paid_1', category: 'debt', title: 'FIRST_PAYOFF', description: 'Fully pay off 1 debt', ascii: ART.lock_open, tier: 2 },
  { key: 'debt_paid_2', category: 'debt', title: 'DOUBLE_PAYOFF', description: 'Fully pay off 2 debts', ascii: ART.lock_open, tier: 2 },
  { key: 'debt_paid_3', category: 'debt', title: 'TRIPLE_PAYOFF', description: 'Fully pay off 3 debts', ascii: ART.lock_open, tier: 3 },
  { key: 'debt_paid_5', category: 'debt', title: 'DEBT_SLAYER', description: 'Fully pay off 5 debts', ascii: ART.trophy_md, tier: 3 },
  { key: 'debt_paid_10', category: 'debt', title: 'DEBT_DESTROYER', description: 'Fully pay off 10 debts', ascii: ART.trophy_lg, tier: 4 },
  { key: 'debt_tracked_1', category: 'debt', title: 'DEBT_AWARE', description: 'Track 1 debt', ascii: ART.chain_brk, tier: 1 },
  { key: 'debt_tracked_3', category: 'debt', title: 'DEBT_MAPPED', description: 'Track 3 debts', ascii: ART.chain_brk, tier: 1 },
  { key: 'debt_tracked_5', category: 'debt', title: 'FULL_PICTURE', description: 'Track 5+ debts', ascii: ART.chain_brk, tier: 2 },

  // ═══ NET WORTH & ASSETS (20) ═══
  { key: 'nw_positive', category: 'networth', title: 'NET_POSITIVE', description: 'Achieve a positive net worth', ascii: ART.chart_up, tier: 2 },
  { key: 'nw_1000', category: 'networth', title: 'FIRST_GRAND_NW', description: 'Net worth reaches $1,000', ascii: ART.chart_up, tier: 2 },
  { key: 'nw_5000', category: 'networth', title: 'FIVE_K_NW', description: 'Net worth reaches $5,000', ascii: ART.chart_up, tier: 2 },
  { key: 'nw_10000', category: 'networth', title: 'TEN_K_NW', description: 'Net worth reaches $10,000', ascii: ART.trophy_sm, tier: 3 },
  { key: 'nw_25000', category: 'networth', title: 'QUARTER_NW', description: 'Net worth reaches $25,000', ascii: ART.trophy_md, tier: 3 },
  { key: 'nw_50000', category: 'networth', title: 'FIFTY_K_NW', description: 'Net worth reaches $50,000', ascii: ART.trophy_md, tier: 3 },
  { key: 'nw_100000', category: 'networth', title: 'SIX_FIG_NW', description: 'Net worth reaches $100,000', ascii: ART.trophy_lg, tier: 4 },
  { key: 'nw_250000', category: 'networth', title: 'QUARTER_MIL_NW', description: 'Net worth reaches $250,000', ascii: ART.diamond, tier: 4 },
  { key: 'nw_500000', category: 'networth', title: 'HALF_MIL_NW', description: 'Net worth reaches $500,000', ascii: ART.diamond, tier: 5 },
  { key: 'nw_1000000', category: 'networth', title: 'MILLIONAIRE_NW', description: 'Net worth reaches $1,000,000', ascii: ART.star, tier: 5 },
  { key: 'asset_1', category: 'networth', title: 'ASSET_ONLINE', description: 'Track 1 asset', ascii: ART.chart_up, tier: 1 },
  { key: 'asset_3', category: 'networth', title: 'PORTFOLIO_START', description: 'Track 3 assets', ascii: ART.chart_up, tier: 1 },
  { key: 'asset_5', category: 'networth', title: 'DIVERSIFIED', description: 'Track 5 assets', ascii: ART.chart_up, tier: 2 },
  { key: 'asset_10', category: 'networth', title: 'ASSET_RICH', description: 'Track 10 assets', ascii: ART.trophy_sm, tier: 3 },
  { key: 'asset_types_2', category: 'networth', title: 'TWO_CLASSES', description: 'Own 2 asset types', ascii: ART.chart_bar, tier: 1 },
  { key: 'asset_types_3', category: 'networth', title: 'TRIPLE_CLASS', description: 'Own 3 asset types', ascii: ART.chart_bar, tier: 2 },
  { key: 'asset_types_4', category: 'networth', title: 'QUAD_CLASS', description: 'Own 4 asset types', ascii: ART.chart_bar, tier: 2 },
  { key: 'asset_types_5', category: 'networth', title: 'PENTA_CLASS', description: 'Own 5 asset types', ascii: ART.chart_bar, tier: 3 },
  { key: 'asset_types_6', category: 'networth', title: 'HEXA_CLASS', description: 'Own 6 asset types', ascii: ART.diamond, tier: 4 },
  { key: 'asset_types_7', category: 'networth', title: 'FULL_SPECTRUM', description: 'Own all 7 asset types', ascii: ART.crown, tier: 5 },

  // ═══ STREAKS (15) ═══
  { key: 'streak_3', category: 'streaks', title: 'UPTIME_3D', description: 'Track spending 3 consecutive days', ascii: ART.grid_7, tier: 1 },
  { key: 'streak_7', category: 'streaks', title: 'UPTIME_7D', description: 'Track spending 7 consecutive days', ascii: ART.grid_7, tier: 1 },
  { key: 'streak_14', category: 'streaks', title: 'UPTIME_14D', description: 'Track spending 14 consecutive days', ascii: ART.grid_7, tier: 2 },
  { key: 'streak_21', category: 'streaks', title: 'UPTIME_21D', description: '21-day tracking streak', ascii: ART.calendar, tier: 2 },
  { key: 'streak_30', category: 'streaks', title: 'MONTH_STREAK', description: '30-day tracking streak', ascii: ART.calendar, tier: 3 },
  { key: 'streak_60', category: 'streaks', title: 'DOUBLE_MONTH', description: '60-day tracking streak', ascii: ART.calendar, tier: 3 },
  { key: 'streak_90', category: 'streaks', title: 'QUARTER_YEAR', description: '90-day tracking streak', ascii: ART.trophy_sm, tier: 3 },
  { key: 'streak_180', category: 'streaks', title: 'HALF_YEAR', description: '180-day tracking streak', ascii: ART.trophy_md, tier: 4 },
  { key: 'streak_365', category: 'streaks', title: 'FULL_YEAR', description: '365-day tracking streak', ascii: ART.trophy_lg, tier: 5 },

  // ═══ MILESTONES / TIME (15) ═══
  { key: 'account_7d', category: 'milestones', title: 'WEEK_ONE', description: 'Account is 7 days old', ascii: ART.clock, tier: 1 },
  { key: 'account_30d', category: 'milestones', title: 'MONTH_ONE', description: 'Account is 30 days old', ascii: ART.clock, tier: 1 },
  { key: 'account_90d', category: 'milestones', title: 'QUARTER_VET', description: 'Account is 90 days old', ascii: ART.clock, tier: 2 },
  { key: 'account_180d', category: 'milestones', title: 'HALF_YEAR_VET', description: 'Account is 6 months old', ascii: ART.clock, tier: 2 },
  { key: 'account_365d', category: 'milestones', title: 'ONE_YEAR_VET', description: 'Account is 1 year old', ascii: ART.medal, tier: 3 },
  { key: 'account_730d', category: 'milestones', title: 'TWO_YEAR_VET', description: 'Account is 2 years old', ascii: ART.medal, tier: 4 },
  { key: 'months_3', category: 'milestones', title: 'Q1_TRACKED', description: 'Track 3 months of data', ascii: ART.calendar, tier: 1 },
  { key: 'months_6', category: 'milestones', title: 'HALF_YEAR_DATA', description: 'Track 6 months of data', ascii: ART.calendar, tier: 2 },
  { key: 'months_12', category: 'milestones', title: 'FULL_YEAR_DATA', description: 'Track 12 months of data', ascii: ART.calendar, tier: 3 },
  { key: 'months_24', category: 'milestones', title: 'TWO_YEAR_DATA', description: 'Track 24 months of data', ascii: ART.trophy_sm, tier: 4 },
  { key: 'months_36', category: 'milestones', title: 'THREE_YEAR_DATA', description: 'Track 36 months of data', ascii: ART.trophy_md, tier: 4 },
  { key: 'months_60', category: 'milestones', title: 'FIVE_YEAR_DATA', description: 'Track 60 months of data', ascii: ART.trophy_lg, tier: 5 },
  { key: 'positive_month', category: 'milestones', title: 'GREEN_MONTH', description: 'Finish a month with positive savings', ascii: ART.dollar, tier: 1 },
  { key: 'positive_3_months', category: 'milestones', title: 'GREEN_QUARTER', description: '3 months of positive savings', ascii: ART.dollar, tier: 2 },
  { key: 'positive_6_months', category: 'milestones', title: 'GREEN_HALF', description: '6 months of positive savings', ascii: ART.dollar, tier: 3 },
];

// ─── Budget Monthly Achievements Generator ────────────────────────────────────
// Generates unique achievements for each month from Jan 2024 → Dec 2030 (84 months)

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

const MONTH_CODENAMES: Record<number, string> = {
  0: 'FROST', 1: 'THAW', 2: 'BLOOM', 3: 'RAIN', 4: 'GROWTH', 5: 'SOLSTICE',
  6: 'HEAT', 7: 'PEAK', 8: 'HARVEST', 9: 'AMBER', 10: 'DUSK', 11: 'FROST_END',
};

function generateBudgetMonthlyAchievements(): AchievementDef[] {
  const achievements: AchievementDef[] = [];
  for (let year = 2024; year <= 2030; year++) {
    for (let month = 0; month < 12; month++) {
      const key = `budget_${year}_${String(month + 1).padStart(2, '0')}`;
      const monthName = MONTH_NAMES[month];
      const codename = MONTH_CODENAMES[month];
      const shortYear = String(year).slice(2);
      achievements.push({
        key,
        category: 'budget',
        title: `${codename}_${shortYear}`,
        description: `Stay on budget every category — ${monthName} ${year}`,
        ascii: ART.shield,
        tier: 2,
      });
    }
  }
  return achievements;
}

// Budget streak achievements
const BUDGET_STREAK_ACHIEVEMENTS: AchievementDef[] = [
  { key: 'budget_streak_1', category: 'budget', title: 'BUDGET_BOOT', description: 'Stay on budget for 1 month', ascii: ART.shield, tier: 1 },
  { key: 'budget_streak_2', category: 'budget', title: 'BUDGET_PAIR', description: 'Stay on budget 2 consecutive months', ascii: ART.shield, tier: 1 },
  { key: 'budget_streak_3', category: 'budget', title: 'BUDGET_Q1', description: 'Stay on budget 3 consecutive months', ascii: ART.shield, tier: 2 },
  { key: 'budget_streak_4', category: 'budget', title: 'BUDGET_QUAD', description: '4 consecutive on-budget months', ascii: ART.shield, tier: 2 },
  { key: 'budget_streak_5', category: 'budget', title: 'BUDGET_PENTA', description: '5 consecutive on-budget months', ascii: ART.trophy_sm, tier: 2 },
  { key: 'budget_streak_6', category: 'budget', title: 'BUDGET_HALF', description: '6 consecutive on-budget months', ascii: ART.trophy_sm, tier: 3 },
  { key: 'budget_streak_9', category: 'budget', title: 'BUDGET_THREE_Q', description: '9 consecutive on-budget months', ascii: ART.trophy_md, tier: 3 },
  { key: 'budget_streak_12', category: 'budget', title: 'BUDGET_ANNUAL', description: '12 consecutive on-budget months', ascii: ART.trophy_lg, tier: 4 },
  { key: 'budget_streak_18', category: 'budget', title: 'BUDGET_MASTER', description: '18 consecutive on-budget months', ascii: ART.diamond, tier: 4 },
  { key: 'budget_streak_24', category: 'budget', title: 'BUDGET_LEGEND', description: '24 consecutive on-budget months', ascii: ART.crown, tier: 5 },
  { key: 'budget_cats_3', category: 'budget', title: 'BUDGET_TRIO', description: 'Budget 3 categories', ascii: ART.chart_bar, tier: 1 },
  { key: 'budget_cats_5', category: 'budget', title: 'BUDGET_FIVE', description: 'Budget 5 categories', ascii: ART.chart_bar, tier: 1 },
  { key: 'budget_cats_10', category: 'budget', title: 'BUDGET_FULL', description: 'Budget 10 categories', ascii: ART.chart_bar, tier: 2 },
  { key: 'budget_cats_15', category: 'budget', title: 'BUDGET_THOROUGH', description: 'Budget 15 categories', ascii: ART.chart_bar, tier: 3 },
  { key: 'budget_cats_20', category: 'budget', title: 'BUDGET_COMPLETE', description: 'Budget 20+ categories', ascii: ART.chart_bar, tier: 4 },
];

// ─── All Achievements ─────────────────────────────────────────────────────────

export const ALL_ACHIEVEMENTS: AchievementDef[] = [
  ...STATIC_ACHIEVEMENTS,
  ...BUDGET_STREAK_ACHIEVEMENTS,
  ...generateBudgetMonthlyAchievements(),
];

// ─── Evaluation Engine ────────────────────────────────────────────────────────

export function evaluateAchievements(ctx: AchievementContext): Set<string> {
  const unlocked = new Set<string>();

  // Helper
  const check = (key: string, condition: boolean) => { if (condition) unlocked.add(key); };

  // ─── Onboarding ───
  check('first_txn', ctx.totalTxns > 0);
  check('first_import', ctx.totalTxns > 0);
  check('first_goal', ctx.totalGoals > 0);
  check('first_debt', ctx.hasDebts);
  check('first_budget', ctx.budgetCategories > 0);
  check('first_asset', ctx.assetTypes > 0);
  check('five_categories', ctx.uniqueCategories >= 5);
  check('two_accounts', ctx.uniqueAccounts >= 2);
  check('ten_categories', ctx.uniqueCategories >= 10);
  check('five_accounts', ctx.uniqueAccounts >= 5);

  // ─── Transactions ───
  const txnMilestones = [1, 10, 25, 50, 100, 250, 500, 750, 1000, 2500, 5000, 10000, 25000, 50000];
  for (const n of txnMilestones) check(`txn_${n}`, ctx.totalTxns >= n);

  const incomeMilestones = [10, 50, 100, 500];
  for (const n of incomeMilestones) check(`income_${n}`, ctx.totalIncomeTxns >= n);

  const expenseMilestones = [10, 50, 100, 500, 1000, 5000, 10000];
  for (const n of expenseMilestones) check(`expense_${n}`, ctx.totalExpenseTxns >= n);

  // ─── Savings ───
  const savedMilestones = [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000, 250000, 500000, 1000000];
  for (const n of savedMilestones) check(`saved_${n}`, ctx.totalSaved >= n);

  const goalMilestones = [1, 2, 3, 5, 10, 25];
  for (const n of goalMilestones) check(`goal_${n}`, ctx.completedGoals >= n);

  const savingsRates = [10, 20, 30, 40, 50, 75];
  for (const n of savingsRates) check(`savings_rate_${n}`, ctx.savingsRate >= n / 100);

  // ─── Debt ───
  const debtPcts = [1, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 99];
  for (const n of debtPcts) check(`debt_payoff_${n}pct`, ctx.hasDebts && ctx.debtPayoffPercent >= n);

  check('debt_free', ctx.isDebtFree && ctx.hasDebts);

  const debtPaidMilestones = [1, 2, 3, 5, 10];
  for (const n of debtPaidMilestones) check(`debt_paid_${n}`, ctx.paidOffDebts >= n);

  const debtTrackedMilestones = [1, 3, 5];
  for (const n of debtTrackedMilestones) check(`debt_tracked_${n}`, ctx.totalDebts >= n);

  // ─── Net Worth ───
  check('nw_positive', ctx.netWorth > 0);
  const nwMilestones = [1000, 5000, 10000, 25000, 50000, 100000, 250000, 500000, 1000000];
  for (const n of nwMilestones) check(`nw_${n}`, ctx.netWorth >= n);

  const assetCountMilestones = [1, 3, 5, 10];
  for (const n of assetCountMilestones) check(`asset_${n}`, ctx.assetTypes >= n); // reusing assetTypes as count here is imprecise, but good enough

  const assetTypeMilestones = [2, 3, 4, 5, 6, 7];
  for (const n of assetTypeMilestones) check(`asset_types_${n}`, ctx.assetTypes >= n);

  // ─── Streaks ───
  const streakMilestones = [3, 7, 14, 21, 30, 60, 90, 180, 365];
  for (const n of streakMilestones) check(`streak_${n}`, ctx.streak >= n);

  // ─── Milestones / Time ───
  const ageMilestones = [7, 30, 90, 180, 365, 730];
  for (const n of ageMilestones) check(`account_${n}d`, ctx.accountAgeDays >= n);

  const monthMilestones = [3, 6, 12, 24, 36, 60];
  for (const n of monthMilestones) check(`months_${n}`, ctx.totalMonthsTracked >= n);

  check('positive_month', ctx.netSavings > 0);
  // positive_3_months and positive_6_months need historical data — we'll check ctx

  // ─── Budget Monthly ───
  for (const [monthKey, compliance] of Object.entries(ctx.monthlyBudgetCompliance)) {
    if (compliance.allOnBudget && compliance.total > 0) {
      const [year, month] = monthKey.split('-');
      const achKey = `budget_${year}_${month}`;
      unlocked.add(achKey);
    }
  }

  // ─── Budget Streaks ───
  const budgetStreakMilestones = [1, 2, 3, 4, 5, 6, 9, 12, 18, 24];
  for (const n of budgetStreakMilestones) check(`budget_streak_${n}`, ctx.consecutiveBudgetMonths >= n);

  const budgetCatMilestones = [3, 5, 10, 15, 20];
  for (const n of budgetCatMilestones) check(`budget_cats_${n}`, ctx.budgetCategories >= n);

  return unlocked;
}

// ─── Category Labels ──────────────────────────────────────────────────────────

export const CATEGORY_LABELS: Record<string, string> = {
  onboarding: 'Onboarding',
  transactions: 'Transactions',
  savings: 'Savings Goals',
  debt: 'Debt Payoff',
  budget: 'Budget',
  networth: 'Net Worth',
  streaks: 'Streaks',
  milestones: 'Milestones',
};

export const TIER_LABELS = ['', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond'];
