# Future Sight — Personal Finance Tracker
## Complete Feature Reference & Architecture Guide

**App type:** Single-file HTML application (~7,200 lines)
**Storage:** Anthropic persistent storage API (`window.storage.get/set/delete`)
**Framework:** Vanilla JS, no libraries, custom DOM helper `h(tag, attrs, ...children)`
**Layout:** Responsive sidebar + main content, dark mode support, full-width ultrawide

---

## TABLE OF CONTENTS

1. [Architecture & State](#1-architecture--state)
2. [Navigation & Views](#2-navigation--views)
3. [Import Pipeline](#3-import-pipeline)
4. [Transaction Management](#4-transaction-management)
5. [Dashboard](#5-dashboard)
6. [Sankey Money Flow](#6-sankey-money-flow)
7. [Savings Goals](#7-savings-goals)
8. [Debt Tracker](#8-debt-tracker)
9. [Net Worth](#9-net-worth)
10. [Subscriptions](#10-subscriptions)
11. [Insights](#11-insights)
12. [Budget](#12-budget)
13. [Health Score](#13-health-score)
14. [Calendar](#14-calendar)
15. [Heatmap](#15-heatmap)
16. [Reports](#16-reports)
17. [Year-over-Year (YoY)](#17-year-over-year-yoy)
18. [Achievements](#18-achievements)
19. [Settings](#19-settings)
20. [Transaction Classification System](#20-transaction-classification-system)
21. [Transfer & Pairing Systems](#21-transfer--pairing-systems)
22. [Refund & Return Handling](#22-refund--return-handling)
23. [Category System](#23-category-system)
24. [Key Helper Functions](#24-key-helper-functions)

---

## 1. ARCHITECTURE & STATE

### State Object (persisted to storage)
```
state = {
  view: "dashboard",           // Current active view
  transactions: [],            // Core data — all financial transactions
  categories: [...],           // User-customizable category list
  calendarEvents: [],          // Scheduled events (bills, paydays)
  manualSubscriptions: [],     // User-added subscriptions
  merchantRules: {},           // {merchantName: category} — user-defined auto-categorize rules
  importHistory: [],           // Log of past imports with filenames and counts
  sidebarOpen: true,           // Sidebar collapse state
  savingsGoals: [],            // Goal objects with contributions, linked accounts, projections
  debts: [],                   // Debt entries with amortization data
  assets: [],                  // Asset entries (checking, savings, investment, property)
  netWorthSnapshots: [],       // Historical snapshots {date, assets, liabilities, netWorth}
  budgets: {},                 // {category: monthlyLimit}
  roadmapProgress: {},         // Legacy field (FIRE roadmap removed, kept for backup compat)
  dashPeriod: "all",           // Dashboard time filter
}
```

### Transaction Object Shape
```
{
  id: "uuid",
  date: "YYYY-MM-DD",
  description: "MERCHANT NAME OR BANK DESC",
  originalDescription: "RAW BANK DESC",  // Preserved on first rename, never overwritten
  amount: -45.99,                         // Negative = expense, Positive = income
  category: "Groceries",
  account: "Chase Checking",
  autoMatched: true,                      // Was auto-categorized
  flagged: false,                         // Flagged for review
  transferPairId: "uuid",                 // Links two transactions as transfer or debt payment pair
  returnPairId: "uuid",                   // Links purchase + refund
}
```

### Storage Layer
- Uses `window.storage.get(key)` / `window.storage.set(key, value)` API
- All state persisted as JSON under individual keys
- `persist(key, value)` helper writes to both `state[key]` and storage
- Additional localStorage keys:
  - `pft-import-draft` — paused import state (phases, rules, linked pairs)
  - `pft-expense-savings` — upcoming expense savings tracker data

### Rendering
- `render()` → clears `#app`, calls `renderSidebar()` + `renderMain()` + `renderMobileNav()`
- `renderMain()` dispatches to view-specific render function based on `state.view`
- Each view has internal `rebuild()` that re-renders just the main content area
- Mobile: bottom nav bar with icons, sidebar hidden
- Desktop: collapsible sidebar with nav items and progress indicators

---

## 2. NAVIGATION & VIEWS

### 14 Views (in sidebar order):
1. **dashboard** — Overview cards, Sankey chart, spending/income charts, goal summaries
2. **transactions** — Full transaction table with search, filter, sort, bulk operations
3. **goals** — Multi-goal savings tracker with projections
4. **debt** — Debt management with amortization, snowball/avalanche
5. **networth** — Assets, liabilities, snapshots, historical chart
6. **subscriptions** — Auto-detected + manual subscriptions with keep/cancel tracking
7. **insights** — Monthly trends, top merchants, spending analysis, YoY comparison, heatmap
8. **budget** — Category budgets with progress bars, upcoming expenses tracker
9. **health** — Financial health score (0-100) with component breakdown
10. **calendar** — Monthly calendar with events, bills, paydays
11. **reports** — CSV/text export, monthly summaries, category breakdowns, income vs expense
12. **settings** — Dark mode, backup/restore, reset, import history
13. **import** — Multi-phase import pipeline (CSV/PDF)
14. **achievements** — Xbox-style achievement system with hidden milestones

### Sidebar Features
- Collapsible with hamburger toggle
- Shows transaction count badge
- Shows total savings progress bar across all goals
- Icons for each nav item (custom SVG paths)
- Mobile bottom nav replicates key items

---

## 3. IMPORT PIPELINE

### Three-Phase Flow

**Phase 1: Loading & Deduplication**
- Accepts CSV files and PDF bank statements
- CSV parsing: auto-detects columns (date, description, amount, account)
- PDF parsing: extracts transaction lines from text content
- Deduplication against existing transactions using `date|description|amount` key
- Uses `originalDescription` for existing transaction dedup (so renamed transactions still match)
- Progress bar animation during processing
- Shows count of new vs duplicate transactions

**Phase 2: Transfer/Debt Payment Pair Detection**
- Scans all new transactions for potential pairs
- Universal pairing: ANY transaction with exact opposite-sign match on different account within 5-day window
- Auto-detects pair type (transfer vs debt payment) based on keywords and category
- Shows suggested pairs with Link/Dismiss buttons
- Blue ⇄ badges for transfers, amber 💳 for debt payments
- Pairs stored via shared `transferPairId` UUID

**Phase 3: Merchant Categorization**
- Groups transactions by extracted merchant name
- Category section headers: Income (green), Refunds & Returns (cyan), Expense (navy), System (gray), Uncategorized (amber with "NEEDS REVIEW" badge)
- **Sign-based auto-categorization**: Positive amounts → Income by default; Negative amounts → keyword-matched expense categories
- User merchant rules (highest priority) override auto-categorization regardless of sign
- Expandable merchant rows show individual transactions
- Selecting a category for a merchant applies to ALL transactions from that merchant
- Category dropdown grouped: Expense → Income → Refunds & Returns → System

**Import Features:**
- Pause/resume: saves draft to `localStorage["pft-import-draft"]` with current phase, rules, and linked pairs
- Multi-file import: can import multiple CSVs in sequence
- Import history log: tracks filename, date, count for each import
- Delete imported batch: can remove all transactions from a specific import

---

## 4. TRANSACTION MANAGEMENT

### Transaction Table
- Columns: Checkbox | Date | Description | Amount | Category | Account | Actions
- **Sortable** by any column (click header)
- **Pagination** at 50 per page
- **Search bar**: matches description, originalDescription, extracted merchant name, account name, and date
- **Category filter** dropdown (grouped: Expense/Income/Refunds & Returns/System)
- **Account filter** dropdown
- **Date range** filter with from/to date inputs

### Editable Descriptions
- Click any description to open inline edit field
- **Autocomplete dropdown** suggests existing merchant names sorted by frequency as you type
- Matching text highlighted in blue
- **Enter** to save, **Escape** to cancel
- Original description preserved in `originalDescription` field on first edit
- **✎ pencil icon** appears next to edited descriptions — hover for tooltip showing original

### Bulk Operations (checkbox selection)
- **Select all** checkbox in header (toggles current page)
- Blue bulk action bar appears when items selected:
  - **Recategorize**: category dropdown → Apply
  - **Rename**: text input with merchant autocomplete → Rename (preserves originalDescription)
  - **Delete**: with confirmation dialog
  - **Clear selection**

### Merchant Bulk Recategorize
- Action column edit icon → enters merchant bulk mode
- Shows merchant name with category dropdown
- Applies category to ALL transactions matching that merchant
- Saves as merchant rule for future auto-categorization

### Visual Indicators
- Transfer pairs: blue "⇄ Transfer pair: [account]" badge (click to unlink)
- Debt payment pairs: amber "💳 Debt Payment pair" badge (click to unlink)
- Return pairs: purple "↩ Return for [merchant] $X" badge (click to unlink)
- Flagged: amber "⚑ Flagged for review" text
- Unlinked transfer/debt/return suggestions with Link buttons

---

## 5. DASHBOARD

### Period Tabs
- **This Month** | **Last Month** | **3 Months** | **YTD** | **All Time**
- **Individual year tabs** for each year with transaction data (e.g., "2024", "2023")
- Current year excluded (covered by YTD)
- Years sorted newest-first, only shown if data exists
- All dashboard content filters by selected period

### Summary Cards (top row)
- **Total Income**: green, shows sum of `isRealIncome()` transactions
- **Total Expenses**: red, net of refunds/returns
- **Net**: blue/red depending on positive/negative
- **Transactions**: count, unique days, daily average

### Velocity Card
- Shows spending velocity: "On pace to spend $X this month"
- Based on daily average × days in month
- Chart shows daily spending progression

### Sankey Money Flow Chart
- Full 4-column flow diagram (see Section 6)
- Only appears when there's sufficient data

### Spending by Category (pie/donut chart)
- SVG donut chart with category breakdown
- Click segments to navigate to filtered transactions

### Monthly Income vs Expenses (bar chart)
- Grouped bars per month showing income (green) and expenses (red)
- Net line overlaid

### Top Merchants
- Ranked list of most-spent merchants with amounts
- Click to navigate to filtered transactions

### Goal Progress Summary
- Shows active savings goals with progress bars
- Quick view of how close each goal is to completion

---

## 6. SANKEY MONEY FLOW

### 4-Column Layout (SVG, 2400×560 viewBox)
```
Column 1: Income Sources (left) — green nodes, left-aligned labels
Column 2: Accounts (center-left) — colored nodes, sized by max(income, expense)
Column 3: Categories (center-right) — colored nodes
Column 4: Top Merchants (right) — colored by parent category
```

### Data Flow
- `incSrcToAcct`: maps income source → account (actual transaction data)
- `acctToCat`: maps account → category (actual transaction data)
- `catToMerchant`: maps category → top merchants
- Ribbons trace exact paths: "Salary → Checking → Groceries → Whole Foods"

### Ribbon Colors
- Income→Account: green gradient to account color
- Account→Category: account color to category color
- Category→Merchant: uniform category color

### Refund Handling
- Refunds/returns netted against their original expense category
- "↩ Refunds & Returns" summary bar below chart (cyan) shows total recovered and per-category breakdown

### Click-Through Navigation
- **All 4 columns clickable** — navigates to Transactions view
- Passes date range from current dashboard period
- Income sources: search by merchant name
- Accounts: search by account name
- Categories: filter by category
- Merchants: search by merchant name
- `sankeyNav()` helper sets `_txnSearch`, `_txnFilterCat`, `_txnDateFrom`, `_txnDateTo`

### Aggregation
- Income sources and merchants grouped, with "Other" aggregation for small items
- "Other Income" and "Other" category use proportional distribution across accounts

---

## 7. SAVINGS GOALS

### Goal Object
```
{
  id, name, targetAmount, currentAmount,
  linkedAccount,            // Auto-credits deposits to this account
  contributions: [{date, amount, note}],
  color, startDate, targetDate,
  monthlyContribution,      // Planned monthly amount
  interestRate,             // HYSA interest rate for projections
  events: [{name, amount, date, type}],  // Windfalls/setbacks
}
```

### Features
- **Tabbed goal cards**: Overview | Projection | Events | Contributions
- **Overview tab**: progress bar, amount remaining, daily/monthly needed, projected completion
- **Projection tab**: SVG line chart with multiple scenarios (base, optimistic, pessimistic), what-if sliders, HYSA interest compounding
- **Events tab**: scheduled windfalls/setbacks that affect projections
- **Contributions tab**: log of all contributions with notes
- **Goal templates**: Emergency Fund, Vacation, House Down Payment, etc.
- **Auto-credit**: links to account — deposits auto-count toward goal
- **Manual contributions**: add/edit with date, amount, note
- **Goal deletion** with confirmation modal
- **Allocation needed** indicator: shows how much more monthly savings needed
- **Celebration animation** when goal completed (confetti effect)
- **Projected completion date** calculator using contribution rate + interest

---

## 8. DEBT TRACKER

### Debt Object
```
{
  id, name, balance, rate (APR %), minPayment, extraPayment,
  type (credit_card, student_loan, mortgage, auto_loan, personal, other),
  startDate, payments: [{date, amount}]
}
```

### Features
- **Amortization schedules**: calculates month-by-month payoff with interest
- **Snowball vs Avalanche comparison modal**: side-by-side total interest and payoff timeline
- **Auto-apply buttons**: Snowball (lowest balance first) and Avalanche (highest APR first) with extra budget input
- **Sorting controls**: by balance or APR, ascending or descending
- **Debt payment pairing**: links negative outgoing payments to positive "Payment Thank You" credits on debt accounts (5-day window, amber badges)
- **SVG payoff chart**: visualizes balance reduction over time
- **Add/edit/delete debts** with modal form

### Debt Payment Transaction Tracking
- Scans transactions with category "Debt Payments"
- Tracks: total paid, payment months, consecutive payment months streak
- Powers debt achievements (see Achievements section)

---

## 9. NET WORTH

### Components
- **Assets**: checking, savings, investment, property, other — manual entry
- **Liabilities**: pulled from debt tracker balances
- **Snapshots**: manual snapshots recording point-in-time net worth
- **Historical chart**: SVG line chart of net worth over time from snapshots
- **Add/edit/delete assets** with modal form
- **Auto-calculated**: total assets - total liabilities = net worth

---

## 10. SUBSCRIPTIONS

### Detection
- `detectSubscriptions()` scans transactions for recurring patterns
- Groups by merchant, looks for monthly/yearly frequency
- Calculates monthly and annual cost

### Management
- **Auto-detected** subscriptions with merchant name, amount, frequency
- **Manual subscriptions**: add custom entries
- **Status tracking**: Keep ✓ | Cancel ✗ | Canceled
- **Monthly/annual totals** summary
- **Cost per day** calculations

---

## 11. INSIGHTS

### Monthly Trends
- Income and expense trends over time
- Average monthly spending
- Month-over-month change indicators

### Top Merchants
- Ranked spending by merchant
- Click to navigate to filtered transactions

### Category Breakdown
- Spending distribution across categories
- Comparison to previous periods

### Contains sub-sections:
- Year-over-Year comparison (see Section 17)
- Spending Heatmap (see Section 15)
- Health Score card (see Section 13)

---

## 12. BUDGET

### Budget System
- **Per-category monthly limits**: set budget for any expense category
- **Auto-build**: generates budgets from average spending per category
- **Progress bars**: green (<80%), amber (80-100%), red (>100%)
- **Rollover support**: unused budget rolls to next month

### Upcoming Expenses Tracker
- **Scheduled expenses** with due dates and amounts
- **Savings tracker per expense**: tracks how much saved toward each
- **Progress bar**: amber (<50%), blue (50-99%), green (100%+)
- **"Add $" button**: log savings toward an expense
- **"Fill" button**: mark full amount as saved instantly
- **"✔ Confirm Saved" button**: appears when fully funded, marks as covered
- **Confirmed expenses**: ✅ strikethrough, "Saved for — you're covered!", undo option
- **Overall summary**: "$X / $Y saved · Z/N confirmed" with total progress bar
- Stored in `localStorage["pft-expense-savings"]`

---

## 13. HEALTH SCORE

### Score Components (0-100 total)
- **Savings rate** (0-25 pts): income vs expenses ratio
- **Emergency fund** (0-20 pts): months of expenses covered
- **Debt-to-income** (0-20 pts): total debt payments vs income
- **Budget adherence** (0-15 pts): spending vs budget limits
- **Diversification** (0-10 pts): variety of income sources
- **Consistency** (0-10 pts): regular saving patterns

### Display
- Large circular score gauge with color coding
- Component breakdown bars
- Tips for improvement based on weakest areas
- Uses `isRealIncome()` for accurate income calculation

---

## 14. CALENDAR

### Features
- **Monthly grid calendar** with navigation arrows
- **Events**: bills, paydays, custom events with amounts
- **Transaction dots**: shows days with spending activity
- **Click a day**: navigates to transactions filtered to that specific date
- **Add/edit/delete events** with modal form
- **Color coding**: bills (red), paydays (green), custom (blue)

---

## 15. HEATMAP

### Three Views (inside Insights)
1. **Day of Week × Month**: average daily spend by DOW and month (last 12 months)
2. **Day of Month**: daily spending across all months — shows which calendar days are expensive
3. **Yearly**: month × year grid showing total spending per month

### Features
- Color intensity scales from light (low spend) to dark red (high spend)
- Dollar amounts in cells
- **Clickable cells** navigate to transactions with correct date range filter
- Daily cells: sets dateFrom and dateTo to same day
- Monthly cells: sets dateFrom to 1st, dateTo to 31st of that month

---

## 16. REPORTS

### Export Options
- **CSV export**: all transactions with Date, Description, Amount, Category, Account
- **Monthly summary report** (text): income, expenses, net, top categories per month
- **Category breakdown report**: spending by category with percentages
- **Income vs Expense report**: monthly comparison

### Income Filtering
- All reports use `isRealIncome()` to exclude transfers, debt payment credits, and refunds from income totals

---

## 17. YEAR-OVER-YEAR (YoY)

### Features
- **5-year support**: compares current year to up to 4 prior years
- **Monthly comparison**: shows spending/income for each month across years
- **Category comparison**: spending by category across years
- **Percentage changes**: highlights increases/decreases
- **SVG charts**: visual comparison bars

### YoY Achievements
- Dynamic achievements for months where spending decreased vs prior year
- Three tiers: 5% savings, 15% big saver, 30% mega saver

---

## 18. ACHIEVEMENTS

### Achievement System
- **Xbox-style badges** with icons, names, and descriptions
- **Toast notifications** when earned (queue system for multiple)
- **Purple gradient theme** on achievements page
- **Mystery icons** (🔒) for locked hidden achievements
- **Progress tracking**: X of Y earned

### Standard Achievements (~18)
- 🌱 First Dollar — first savings goal contribution
- 💯 10% There — goal reached 10%
- 💰 Quarter Way — goal reached 25%
- 🖐️ Halfway — goal reached 50%
- 🌟 Almost There — goal reached 75%
- 👑 Goal Complete — fully funded a goal
- 🏆 Hat Trick — completed 3 goals
- 📋 Budget Creator — set up first budget
- 🎯 Goal Setter — created first goal
- 🏅 Goal Crusher — completed first goal
- 🎉 Debt Free — total liabilities under $100
- ⚡ Extra Payer — set extra payments on a debt
- 📸 Snapshot Taker — first net worth snapshot
- 📝 Data Driven — imported 10+ transactions
- 📊 Hundred Club — 100+ transactions

### Debt Payment Achievements (7)
- 💸 First Payment — made first debt payment transaction
- 📅 Consistent Payer — 3+ consecutive months of payments
- ⚔️ Payment Warrior — 6+ consecutive months
- 💪 $1K Paid — cumulative $1,000+ in debt payments
- 🔥 $5K Paid — cumulative $5,000+
- ⭐ $10K Paid — cumulative $10,000+
- 🌟 $25K Paid — cumulative $25,000+
- 💳 Debt Destroyer — no credit card debt remaining

### Hidden Achievements (16)
- Exploration-based: visiting all views, using specific features
- Time-based: using the app on weekends, late night, specific dates
- Data milestones: large transaction counts, diverse merchants
- Easter eggs: specific action combinations
- Require `hidden: true` flag — show as locked mystery icons until earned

### YoY Dynamic Achievements
- Generated per-month when spending decreases vs prior year
- Three tiers per month (5%, 15%, 30% reduction)

---

## 19. SETTINGS

### Features
- **Dark mode toggle**: comprehensive dark mode for all views/components
- **JSON backup**: exports complete state as JSON file
- **JSON restore**: imports backup, merges with existing data, 12 persist() calls
- **Reset**: comprehensive reset with confirmation modal — clears all data, localStorage keys
- **Import history**: log of past imports with delete option
- **Sidebar collapse** state persistence

---

## 20. TRANSACTION CLASSIFICATION SYSTEM

### Income Detection: `isRealIncome(t)`
Returns true ONLY for genuine income. Excludes:
- Transfers (`isTransfer`)
- Paired debt payments (`isPairedDebtPayment`)
- Debt payment credits (`isDebtPaymentCredit`)
- Returns/refunds (`isReturn`)

### Debt Payment Credit Detection: `isDebtPaymentCredit(t)`
Identifies positive transactions that are debt payment receipts (e.g., "Payment Thank You"):
- `amount > 0` AND (`category === "Debt Payments"` OR description matches `DEBT_PAYMENT_KEYWORDS`)

### Exclusion Functions
- `excludeTransfers(txns)`: removes transfers, paired debt payments, AND debt payment credits
- `excludeReturns(txns)`: removes returns/refunds
- `excludeTransfersAndReturns(txns)`: removes all non-spending transactions

### Applied Throughout
- Dashboard income totals
- Sankey income filtering
- Insights monthly income
- Health score income
- Reports income totals
- Budget calculations

---

## 21. TRANSFER & PAIRING SYSTEMS

### Transfer Pairing
- **Detection**: opposite-sign amounts on different accounts within 5-day window
- **Universal**: no keyword requirement — any matching pair gets suggestion
- **Storage**: shared `transferPairId` UUID on both transactions
- **Visual**: blue ⇄ badge, click to unlink
- **Auto-detect type**: transfer (blue) vs debt payment (amber) based on keywords/category

### Debt Payment Pairing
- Same mechanism as transfers but for debt payments
- Keywords: loan, payment, mortgage, student loan, etc.
- Amber 💳 badge when paired
- Prevents "Payment Thank You" credits from counting as income

### Return/Refund Pairing
- **Detection**: `findReturnCandidates()` — same merchant, opposite sign
- **Storage**: shared `returnPairId` UUID
- **Visual**: purple ↩ badge with purchase details
- **Categories**: "Returns" and "Refunds" in `REFUND_CATEGORIES` set

### Unmatched Transfer Reconciliation (Transactions view)
- Section below transaction table showing unmatched transfers
- Exact match, best-guess, and manual pairing options
- Auto-match-all button
- Dismiss option (sets `transferPairId: "dismissed"`)

---

## 22. REFUND & RETURN HANDLING

### Classification
- `REFUND_CATEGORIES = new Set(["Returns", "Refunds"])`
- Removed from `INCOME_CATEGORIES` — refunds are NOT income
- `isReturn(t)`: checks `REFUND_CATEGORIES.has(t.category) || !!t.returnPairId`

### Sankey Treatment
- Refunds netted against their original expense category spending
- If paired return exists, uses paired purchase's category
- Summary bar below Sankey: "↩ Refunds & Returns: +$X recovered"
- Shows per-category breakdown of netted amounts

### Category Dropdown Placement
- Own group "Refunds & Returns" (cyan) in all category dropdowns
- Between Income and System groups

---

## 23. CATEGORY SYSTEM

### Default Categories (in order)
**Expense:** Groceries, Restaurants, Food & Dining, Shopping, Transportation, Housing, Utilities, Insurance, Healthcare, Personal Care, Education, Entertainment, Subscriptions, Gifts & Donations, Travel, Fees & Charges, Other Expenses

**Income:** Income, Salary, Freelance, Investments, Rental Income, Side Hustle, Other Income

**Refunds & Returns:** Returns, Refunds

**System:** Transfers, Debt Payments, Savings, Uncategorized

### Auto-Categorization Logic (`autoCategorize()`)
**Priority order:**
1. User merchant rules (always respected, any sign)
2. Sign-based routing:
   - **Positive (+)**: debt payment keywords → "Debt Payments"; return keywords → "Returns"; transfer keywords → "Transfers"; everything else → "Income"
   - **Negative (-)**: keyword match against `KEYWORD_CATEGORIES` (expense categories only, "Income" group skipped); no match → stays "Uncategorized"

### Keyword Map (`KEYWORD_CATEGORIES`)
Extensive keyword map covering: Groceries (35+ keywords), Restaurants (50+), Food & Dining, Transportation (40+), Shopping (40+), Subscriptions (30+), Utilities (25+), Insurance, Healthcare, Entertainment, Education, Personal Care, Gifts & Donations, Travel (25+), Fees & Charges, Housing, Income, Transfers, Debt Payments, Savings

### Category Colors
Each category has a defined color in `CATEGORY_COLORS` map, used consistently across dots, charts, Sankey, badges.

---

## 24. KEY HELPER FUNCTIONS

### DOM & Rendering
- `h(tag, attrs, ...children)` — createElement helper, handles style objects, className, event listeners, innerHTML. Robust child handling: strings, numbers, nodes, null all safe.
- `catDot(category, size)` — colored circle indicator
- `icon(paths, cls)` — SVG icon from path data
- `fmt(n)` — formats number as `$1,234.56`
- `getColor(category)` — returns category color

### Transaction Processing
- `extractMerchant(desc)` — strips trailing numbers, uppercases, truncates to 30 chars
- `dedup(newTxns, existing)` — deduplicates using `date|description|amount` key
- `removeDupes(txns)` — removes internal duplicates
- `parseCSV(text)` — auto-detects columns, returns transaction array
- `parsePdfTxns(pages)` — extracts transactions from PDF text

### Financial Calculations
- `calcAmortization(balance, rate, payment, extra)` — month-by-month amortization schedule
- `calcGoalProgress(goal, txns)` — combines contributions + auto-credits
- `calcProjectedCompletion(goal)` — estimates completion date
- `calcActualMonthlySavings()` — real savings rate from transactions
- `calcAllocationNeeded(goal)` — monthly amount needed to hit target by date
- `computeHealthScore()` — 0-100 financial health score with component breakdown
- `detectSubscriptions()` — scans transactions for recurring patterns

### State Management
- `persist(key, value)` — writes to state AND storage
- `store.get(k)` / `store.set(k, v)` / `store.del(k)` — low-level storage API
- `render()` — full re-render of entire UI
- `rebuild()` — re-render just current view's main content (used within views)
- `checkAchievements()` — evaluates all achievement conditions, fires toasts for new ones

---

## DEVELOPMENT NOTES

### Testing
- All 14 views validated to render without errors
- Seed data generator creates 600+ transactions, 3 debts, 4 assets, 2 goals, 6 snapshots
- Syntax validation via `new Function(scriptContent)`

### Dark Mode
- CSS variables swap between light/dark palettes
- `.dark-mode` class on body
- All components, modals, dropdowns, charts support dark mode

### Responsive Design
- Full-width layout (no max-width cap) for ultrawide monitors
- Mobile bottom nav replaces sidebar
- Responsive SVG charts scale to container width
- Period tabs wrap to second line on narrow screens

### Backup Compatibility
- Backup includes all state fields
- Restore gracefully handles missing fields (legacy `roadmapProgress`, etc.)
- 12 individual `persist()` calls on restore to ensure all data saved
