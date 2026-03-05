# Future Sight: Web App Feature Parity Project Plan
## Plaid-First Architecture

---

## HOW PLAID CHANGES EVERYTHING

Plaid provides rich data that eliminates much of the manual work the HTML app required:

**What Plaid gives us automatically:**
- **Transactions** with clean merchant names, categories (personal_finance_category), amounts, dates
- **Account types**: `depository` (checking/savings), `credit` (credit cards), `loan` (student loans, mortgages)
- **Account subtypes**: checking, savings, credit card, student, mortgage, auto, etc.
- **Balances**: current balance, available balance, credit limits
- **Merchant data**: clean merchant_name, logo URL, location
- **Category data**: Plaid's own `personal_finance_category` with primary + detailed categories

**What this means for our app:**
- **Debts auto-populated**: credit card and loan accounts from Plaid → auto-create debt entries with real balances
- **Assets auto-populated**: depository accounts from Plaid → auto-create asset entries with real balances
- **Net worth auto-calculated**: assets (depository balances) - liabilities (credit + loan balances) = net worth, updated on every sync
- **Categories pre-filled**: Plaid's personal_finance_category maps to our categories, reducing "Uncategorized" dramatically
- **Transfer detection improved**: same-institution transfers are flagged by Plaid's transaction data
- **Account names real**: "Chase Checking ••1234" instead of "CSV Import"

---

## DATABASE CHANGES NEEDED

### New Table: PlaidAccount (stores individual accounts within a linked institution)
```
PlaidAccount {
  id, plaidItemId, plaidAccountId (unique), 
  name, officialName, mask,
  type (depository/credit/loan/investment),
  subtype (checking/savings/credit card/student/mortgage/auto),
  balanceCurrent, balanceAvailable, balanceLimit,
  lastBalanceUpdate, isActive
}
```

### Modified Tables:
- **Debt**: add `plaidAccountId` — links to PlaidAccount for auto-balance updates
- **Asset**: add `plaidAccountId` — links to PlaidAccount for auto-balance updates
- **Transaction**: already has `plaidTransactionId` — add `plaidAccountId` for account linking

### New Sync Behavior:
- On each Plaid sync: update transactions AND update all account balances
- Auto-create/update Debt entries for `type: credit` and `type: loan` accounts
- Auto-create/update Asset entries for `type: depository` accounts
- Auto-snapshot net worth after each sync

---

## SPRINT PLAN (8 Sprints)

---

### Sprint 1: Plaid Account Sync & Auto-Debt/Asset Creation
**Priority: CRITICAL — Foundation for everything else**
**Estimated: 4-5 hours**

**What we build:**
1. **PlaidAccount database table** — stores individual accounts from linked institutions
2. **Enhanced sync route** — on Plaid sync, also call `/accounts/get` to pull account types and balances
3. **Auto-debt creation** — when Plaid returns a `credit` or `loan` account:
   - If no matching Debt exists → create one with name, balance, type mapped from Plaid subtype
   - If matching Debt exists → update balance from Plaid's `balanceCurrent`
   - Map subtypes: `credit card` → credit_card, `student` → student_loan, `mortgage` → mortgage, `auto` → auto_loan
4. **Auto-asset creation** — when Plaid returns a `depository` account:
   - If no matching Asset exists → create one with name, balance, type mapped from subtype
   - If matching Asset exists → update value from Plaid's `balanceCurrent`
   - Map subtypes: `checking` → checking, `savings` → savings, `money market` → savings
5. **Auto net worth snapshot** — after each sync, if balances changed, auto-create a NetWorthSnapshot
6. **Plaid category mapping** — map Plaid's `personal_finance_category.primary` to our category system:
   - INCOME → Income
   - TRANSFER_IN/TRANSFER_OUT → Transfers
   - LOAN_PAYMENTS → Debt Payments
   - FOOD_AND_DRINK → Restaurants
   - GENERAL_MERCHANDISE → Shopping
   - TRANSPORTATION → Transportation
   - RENT_AND_UTILITIES → Utilities/Housing
   - (full mapping for all ~20 Plaid categories)

**Why first:** Every other sprint depends on accurate account data and proper categorization from Plaid.

---

### Sprint 2: Transaction Classification System
**Priority: CRITICAL — All financial calculations depend on this**
**Estimated: 3-4 hours**

**What we build:**
1. **`isRealIncome(t)`** — returns true only for genuine income. Excludes transfers, paired debt payments, debt payment credits, returns/refunds
2. **`isDebtPaymentCredit(t)`** — identifies positive transactions that are debt payment receipts
3. **`isReturn(t)`** — identifies refunds/returns
4. **`excludeTransfers(txns)`** — removes transfers, paired debt payments, AND debt payment credits
5. **`excludeTransfersAndReturns(txns)`** — removes all non-spending transactions
6. **Apply everywhere** — dashboard income totals, insights, health score, reports, budget, Sankey
7. **Plaid enhancement** — use Plaid's `personal_finance_category` to auto-detect transfers and loan payments that the keyword system might miss

**Why second:** Every dollar figure shown in the app is wrong without this.

---

### Sprint 3: Auto-Categorization Engine
**Priority: HIGH — Reduces manual work dramatically**
**Estimated: 3 hours**

**What we build:**
1. **Plaid category mapper** — primary mapping layer using Plaid's `personal_finance_category`
2. **Keyword fallback engine** — port 300+ keywords from HTML app for CSV/PDF imports and uncategorized Plaid transactions
3. **Sign-based routing** — positive amounts default to Income unless keyword-matched otherwise
4. **Merchant rules as highest priority** — user rules always override both Plaid categories and keyword matching
5. **Apply on import AND on Plaid sync** — new transactions get categorized before being saved
6. **Bulk re-categorize** — when user changes a merchant's category, offer to apply to all past transactions from that merchant

**Plaid advantage:** Most transactions arrive pre-categorized. The keyword engine only fires for: CSV/PDF imports, Plaid transactions where `personal_finance_category` is null, and when users override categories.

---

### Sprint 4: Transaction Table Power Features
**Priority: HIGH — Daily workflow depends on this**
**Estimated: 4-5 hours**

**What we build:**
1. **Inline editable descriptions** — click to edit, autocomplete from merchant history, preserves `originalDescription`
2. **Bulk operations bar** — select multiple → recategorize / rename / delete
3. **Visual badges** — transfer pairs (blue ⇄), debt payments (amber 💳), returns (purple ↩), with unlink buttons
4. **Merchant bulk recategorize** — edit icon → applies category to ALL transactions from that merchant + saves as merchant rule
5. **Account filter dropdown** — filter by linked Plaid account name
6. **Date range filter** — from/to date inputs
7. **Category filter grouped** — Expense / Income / Refunds & Returns / System sections

**Plaid advantage:** Account names from Plaid are clean and real ("Chase Checking ••1234") making the account filter immediately useful.

---

### Sprint 5: Dashboard Sankey & Period Tabs
**Priority: HIGH — Signature feature**
**Estimated: 5-6 hours**

**What we build:**
1. **4-column Sankey** (d3-sankey): Income Sources → Accounts → Categories → Top Merchants
2. **Clickable nodes** — navigate to filtered transactions with date range
3. **Refund netting** — refunds subtracted from their expense category in the flow
4. **Period tabs** — This Month / Last Month / 3 Months / YTD / All / individual year tabs
5. **Velocity card** — "On pace to spend $X this month"
6. **Top merchants list** — ranked by spend with click-through
7. **Summary cards use `isRealIncome()`** — accurate income/expense/net/savings rate

**Plaid advantage:** Plaid's merchant_name field provides cleaner merchant groupings for the Sankey than extracted merchant names from raw bank descriptions.

---

### Sprint 6: Goals Projections & Debt Amortization
**Priority: MEDIUM-HIGH — Core financial planning**
**Estimated: 4-5 hours**

**What we build:**
1. **Goals: Tabbed cards** — Overview / Projection / Events / Contributions
2. **Goals: SVG projection chart** — base, optimistic, pessimistic scenarios with what-if sliders
3. **Goals: Linked accounts** — link to Plaid depository account, auto-credit deposits
4. **Goals: HYSA interest compounding** — factor in interest rate for projections
5. **Goals: Events** — scheduled windfalls/setbacks
6. **Debts: Amortization schedules** — month-by-month payoff with interest
7. **Debts: Snowball vs Avalanche comparison** — side-by-side modal
8. **Debts: SVG payoff chart** — balance reduction visualization
9. **Debts: Auto-balance from Plaid** — credit card and loan balances update on every sync

**Plaid advantage:** Debt balances are always current. When user syncs, credit card balance updates automatically — no manual entry. Student loan principal remaining comes directly from Plaid.

---

### Sprint 7: Import Pipeline Phases 2 & 3 + Refund Handling
**Priority: MEDIUM — Improves bulk import workflow**
**Estimated: 4-5 hours**

**What we build:**
1. **Import Phase 2: Transfer/Debt Payment Pair Detection** — scan new transactions for opposite-sign matches on different accounts within 5 days, Link/Dismiss UI
2. **Import Phase 3: Merchant Categorization Review** — grouped by merchant with category headers (Income green, Expense navy, Uncategorized amber), category dropdown per group
3. **Return pair detection** — `returnPairId` system, find same-merchant opposite-sign matches
4. **Refund netting** — refunds subtracted from expense categories in Sankey and financial calculations
5. **Category dropdown grouping** — Expense / Income / Refunds & Returns / System sections everywhere

**Plaid advantage:** For Plaid-synced transactions, Phase 2 is less critical because Plaid already identifies transfers via `personal_finance_category`. Phases 2 & 3 primarily benefit CSV/PDF imports. But the refund handling system benefits everyone.

---

### Sprint 8: Budget Upgrade, Reports, Calendar, Polish
**Priority: MEDIUM — Important but not blocking**
**Estimated: 4-5 hours**

**What we build:**
1. **Budget auto-build** — generate budgets from average spending per category (Plaid data makes this highly accurate)
2. **Budget rollover** — unused budget carries to next month
3. **Upcoming expenses tracker** — savings progress per scheduled expense, fill/confirm buttons
4. **Calendar: transaction dots** — show spending activity on calendar days
5. **Calendar: click-through** — click day → transactions filtered to that date
6. **Reports: CSV export** — all transactions
7. **Reports: Monthly summary** — income/expenses/net per month
8. **Reports: Category breakdown** — spending by category with percentages
9. **Health Score: full 6-component breakdown** — savings rate, emergency fund, debt-to-income, budget adherence, diversification, consistency
10. **Achievements: debt-specific** — 7 debt payment achievements
11. **Achievements: hidden** — 16 hidden exploration achievements
12. **Subscriptions: keep/cancel status** — status tracking per subscription
13. **Sidebar: transaction count badge + goals progress bar**

**Plaid advantage:** Budget auto-build uses real Plaid spending data. Health score debt-to-income ratio uses real Plaid balances. Emergency fund calculation uses real checking/savings balances.

---

## TOTAL ESTIMATED: 32-39 hours across 8 sprints

---

## PLAID DATA FLOW SUMMARY

```
User clicks "Connect Bank Account"
  → Plaid Link opens → user authenticates
  → We get access_token + item_id
  → We call /accounts/get → get all accounts with types, subtypes, balances
  → We call /transactions/sync → get all transactions with categories, merchants
  
On each sync:
  1. Update/create PlaidAccount records (balances, names)
  2. For credit/loan accounts → update/create Debt entries
  3. For depository accounts → update/create Asset entries  
  4. For new transactions → categorize using: Plaid category → merchant rules → keyword engine
  5. Auto-detect transfer pairs from Plaid's transfer category
  6. Auto-snapshot net worth if balances changed
  7. Trigger subscription detection on new recurring patterns
```

---

## RULES FOR IMPLEMENTATION
1. Each sprint is self-contained — no breaking existing features
2. Plaid sync enhances but never breaks CSV/PDF import path
3. Manual data entry always remains available (not everyone will use Plaid)
4. Test after each sprint on live Vercel deployment
5. Database migrations run via `npx prisma db push` before code deploy
6. No changes to auth or middleware
7. Plaid sandbox testing with user_good/pass_good throughout development
8. Switch to production Plaid only after all sprints complete
