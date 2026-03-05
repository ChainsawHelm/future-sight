# Future Sight — Claude Code Handoff Document
## Complete Context for Continuing Development

---

## PROJECT OVERVIEW

**Future Sight** is a personal finance tracker web application. It was originally a single-file HTML app (~7,200 lines vanilla JS) and has been converted to a full-stack Next.js 14 + PostgreSQL + Prisma application, deployed on Vercel with Supabase as the database.

**Live URL:** https://futuresightfinance.com
**GitHub:** https://github.com/ChainsawHelm/future-sight
**Local project path:** ~/OneDrive/Desktop/future-sight-v1.3.1-final/future-sight

---

## TECH STACK

- **Frontend:** Next.js 14 (App Router), React 18, Tailwind CSS 3, Recharts
- **Backend:** Next.js API Routes, Prisma ORM 6.x
- **Database:** PostgreSQL 16 on Supabase (free tier)
- **Auth:** NextAuth.js v5 beta with credentials provider (email/password, bcrypt)
- **Hosting:** Vercel (free tier)
- **Domain:** futuresightfinance.com
- **Plaid:** Sandbox mode, partially integrated (button not fully working yet)

---

## CURRENT FILE STRUCTURE

```
future-sight/
├── prisma/
│   ├── schema.prisma          # 16 tables including PlaidItem
│   └── seed.ts                # Demo data seeder
├── src/
│   ├── app/
│   │   ├── (auth)/            # Login/register pages
│   │   ├── (dashboard)/       # All authenticated pages (18 routes)
│   │   │   ├── dashboard/
│   │   │   ├── transactions/
│   │   │   ├── import/
│   │   │   ├── goals/
│   │   │   ├── debts/
│   │   │   ├── networth/
│   │   │   ├── budget/
│   │   │   ├── subscriptions/
│   │   │   ├── calendar/
│   │   │   ├── insights/
│   │   │   ├── health/
│   │   │   ├── heatmap/
│   │   │   ├── reports/
│   │   │   ├── cashflow/
│   │   │   ├── yoy/
│   │   │   ├── achievements/
│   │   │   └── settings/
│   │   ├── api/
│   │   │   ├── auth/          # NextAuth routes
│   │   │   ├── plaid/         # 4 Plaid routes (create-link-token, exchange-token, sync, accounts)
│   │   │   ├── transactions/  # CRUD + bulk operations
│   │   │   ├── dashboard/
│   │   │   ├── goals/
│   │   │   ├── debts/
│   │   │   ├── budgets/
│   │   │   ├── subscriptions/
│   │   │   ├── calendar/
│   │   │   ├── assets/
│   │   │   ├── networth/
│   │   │   ├── categories/
│   │   │   ├── merchant-rules/
│   │   │   ├── import/
│   │   │   ├── settings/
│   │   │   ├── backup/
│   │   │   └── parse-pdf/
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   │   ├── auth/              # Login/register forms
│   │   ├── layout/            # App shell with sidebar
│   │   ├── plaid/             # PlaidLinkButton, PlaidAccounts
│   │   ├── shared/            # Amount, CategoryBadge, EmptyState, ErrorAlert, Skeletons, Spinner, StatCard
│   │   ├── ui/                # Button, Input, Label (shadcn-style)
│   │   └── views/             # All 17 view components
│   ├── hooks/                 # useFetch, useMutation, useKeyboardShortcuts, useData
│   ├── lib/                   # auth.ts, prisma.ts, plaid.ts, api-client.ts, api-auth.ts, import-engine.ts, utils.ts, defaults.ts, rate-limit.ts, sanitize.ts
│   └── types/                 # models.ts, pdf-parse.d.ts
├── e2e/                       # Playwright tests (4 spec files)
├── public/                    # manifest.json, icons
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
├── package.json
└── docker-compose.yml         # For local Docker deployment (not used on Vercel)
```

---

## DATABASE SCHEMA (Prisma)

16 tables:
- **User** — NextAuth user with hashedPassword
- **Account** — NextAuth OAuth accounts
- **Session** — NextAuth sessions
- **VerificationToken** — NextAuth email verification
- **Transaction** — Core financial data (date, description, amount, category, account, plaidTransactionId)
- **ImportRecord** — Import history (filename, count, date)
- **Category** — User-customizable categories with group/color
- **MerchantRule** — {merchant: category} auto-categorize rules
- **SavingsGoal** — Goals with target amount, contributions
- **GoalContribution** — Individual contributions to goals
- **Debt** — Debts with balance, APR, payments
- **Asset** — Assets with value and type
- **NetWorthSnapshot** — Point-in-time net worth records
- **Subscription** — Tracked subscriptions
- **CalendarEvent** — Bills, paydays, custom events
- **Budget** — Per-category monthly limits (unique on userId+category)
- **Achievement** — Earned achievements
- **UserSettings** — Dark mode, currency, locale preferences
- **PlaidItem** — Linked Plaid institutions (itemId, accessToken, cursor, institutionName)

Key fields on Transaction:
- `plaidTransactionId` (String? @unique) — links to Plaid transaction
- `transferPairId` (String?) — links transfer pairs
- `returnPairId` (String?) — links refund pairs
- `originalDescription` (String?) — preserved when user renames
- `autoMatched` (Boolean) — was auto-categorized

---

## IMPORTANT ARCHITECTURAL DECISIONS

1. **`typescript.ignoreBuildErrors: true`** in next.config.js — Prisma's generated types are overly strict about `userId` in create operations. This was needed to get the build passing on Vercel.

2. **Middleware is pass-through** — `src/middleware.ts` lets all requests through. Auth is handled by individual API routes using `auth()` from `@/lib/auth` and by the dashboard layout.

3. **No `output: 'standalone'`** in next.config.js — removed for Vercel deployment.

4. **`eslint.ignoreDuringBuilds: true`** — eslint v8 has peer dependency issues with Next 14.

5. **`strict: false`** in tsconfig.json — needed to avoid implicit `any` errors throughout the codebase.

6. **API auth pattern** — Plaid routes use `const session = await auth()` from `@/lib/auth`. Other routes use `requireAuth()` from `@/lib/api-auth` which returns `{ userId }`. These are two different patterns that coexist.

---

## VERCEL ENVIRONMENT VARIABLES

```
DATABASE_URL=postgresql://postgres.prfmpzpailepajbnefgx:[PASSWORD]@aws-0-us-west-2.pooler.supabase.com:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres.prfmpzpailepajbnefgx:[PASSWORD]@aws-0-us-west-2.pooler.supabase.com:5432/postgres
NEXTAUTH_SECRET=[generated secret]
NEXTAUTH_URL=https://futuresightfinance.com
PLAID_CLIENT_ID=[Plaid client ID]
PLAID_SECRET=[Plaid sandbox secret]
PLAID_ENV=sandbox
```

---

## CURRENT BUG: PLAID LINK BUTTON NOT WORKING

**Symptom:** The "Connect Bank Account" button appears on the Import page but clicking it does nothing.

**Root cause:** `window.Plaid` is `undefined`. The Plaid CDN script (`https://cdn.plaid.com/link/v2/stable/link-initialize.js`) is being blocked, likely by the Content Security Policy in `next.config.js`.

**The CSP in next.config.js has:**
```
script-src 'self' 'unsafe-inline' 'unsafe-eval'
```
This blocks external scripts from cdn.plaid.com.

**Fix needed:** Add `https://cdn.plaid.com` to the `script-src` directive in the CSP header in `next.config.js`. Also add `https://cdn.plaid.com` to `connect-src` for the API calls.

**Current button implementation** (src/components/plaid/plaid-link-button.tsx):
- Loads Plaid SDK via `<script>` tag from CDN (not the React hook — we tried that, it didn't work)
- Fetches link token from `/api/plaid/create-link-token` (this works — returns 200)
- Calls `window.Plaid.create()` on click — fails because script is blocked
- After user authenticates, calls `/api/plaid/exchange-token` then `/api/plaid/sync`

---

## FEATURE PARITY STATUS (HTML App vs Web App)

The web app is at approximately **65% feature parity** with the original HTML app.

### What's WORKING:
- Auth (login/register/session)
- All 17 navigation views render
- Transaction list with search/sort/pagination
- CSV and PDF import with auto-categorization and dedup
- Recharts charts on dashboard and insights
- Goals CRUD with progress bars
- Debts CRUD
- Net worth with assets/snapshots
- Budget with progress bars
- Subscriptions with auto-detect
- Calendar with events
- Health score (simplified)
- Heatmap (basic)
- Reports (basic)
- Year-over-Year (basic)
- Achievements (basic)
- Settings with dark mode
- Keyboard shortcuts
- Loading skeletons
- PWA manifest
- Plaid integration (partially — API routes work, button blocked by CSP)

### What's MISSING (in priority order):

**CRITICAL:**
1. Transaction classification system — `isRealIncome()`, `isReturn()`, `excludeTransfers()` — ALL financial calculations are wrong without this
2. Auto-categorization keyword engine (300+ keywords) — most transactions stay "Uncategorized"
3. Transaction table power features — inline editing, bulk ops, badges, merchant recategorize

**HIGH:**
4. Dashboard Sankey 4-column money flow diagram
5. Dashboard period tabs (This Month/Last Month/3 Months/YTD/Year)
6. Import phases 2 & 3 (transfer pair detection, merchant review)
7. Goals projections with what-if scenarios
8. Debt amortization, snowball vs avalanche

**MEDIUM:**
9. Budget auto-build, rollover, upcoming expenses tracker
10. Refund/return pair handling system
11. Calendar transaction dots and click-through
12. Reports export formats (CSV, monthly summary, category breakdown)
13. Full health score 6-component breakdown

**LOW:**
14. Achievements (debt-specific, hidden, YoY dynamic)
15. Subscriptions keep/cancel status
16. Sidebar badges/progress bar
17. Category dropdown grouping everywhere

---

## PROJECT PLAN — 8 SPRINTS (Plaid-First Architecture)

### Sprint 1: Plaid Account Sync & Auto-Debt/Asset Creation
- Fix CSP to allow Plaid CDN scripts
- Create PlaidAccount table for individual accounts (type, subtype, balances)
- Enhanced sync: pull account types/balances alongside transactions
- Auto-create Debt entries from credit/loan Plaid accounts
- Auto-create Asset entries from depository Plaid accounts
- Auto-snapshot net worth after sync
- Map Plaid personal_finance_category to our categories

### Sprint 2: Transaction Classification System
- Implement isRealIncome(), isDebtPaymentCredit(), isReturn(), excludeTransfers()
- Apply to dashboard, insights, health score, reports, budget
- Use Plaid's category data to enhance detection

### Sprint 3: Auto-Categorization Engine
- Plaid category mapper as primary layer
- Port 300+ keyword fallback engine from HTML app
- Sign-based routing, merchant rules as highest priority

### Sprint 4: Transaction Table Power Features
- Inline editable descriptions with autocomplete
- Bulk operations (recategorize/rename/delete)
- Visual badges for transfers/debt payments/returns
- Account and date range filters

### Sprint 5: Dashboard Sankey & Period Tabs
- 4-column Sankey (d3-sankey already in deps)
- Clickable nodes, period tabs, velocity card

### Sprint 6: Goals Projections & Debt Amortization
- Tabbed goal cards, SVG projections, linked accounts
- Amortization schedules, snowball vs avalanche, auto-balance from Plaid

### Sprint 7: Import Pipeline Phases 2 & 3 + Refund Handling
- Transfer/debt payment pair detection UI
- Merchant categorization review screen
- Return pair system, refund netting

### Sprint 8: Budget Upgrade, Reports, Calendar, Polish
- Budget auto-build, rollover, upcoming expenses
- Calendar dots, click-through, reports export
- Full health score, debt achievements, hidden achievements

---

## DEPLOYMENT WORKFLOW

1. Make changes locally in the project folder
2. Test locally if possible (npm run dev — requires local .env with database URLs)
3. Git Bash commands:
   ```
   cd ~/OneDrive/Desktop/future-sight-v1.3.1-final/future-sight
   git add .
   git commit -m "description of change"
   git push
   ```
4. Vercel auto-deploys on push
5. If database schema changes: run `npx prisma db push` from Git Bash (needs .env file with DIRECT_URL)
6. Verify on https://futuresightfinance.com

---

## DEMO ACCOUNT

- Email: demo@futuresight.app
- Password: Demo1234
- Has 12 months of seed data (~300 transactions, goals, debts, budgets, etc.)

---

## KEY FILES TO KNOW

- `src/lib/auth.ts` — NextAuth config, exports `{ handlers, auth, signIn, signOut }`
- `src/lib/prisma.ts` — Prisma client singleton
- `src/lib/plaid.ts` — Plaid API client config
- `src/lib/api-client.ts` — Frontend API wrapper (transactionsApi, goalsApi, etc.)
- `src/lib/api-auth.ts` — `requireAuth()` helper for API routes
- `src/lib/import-engine.ts` — CSV import processing (merchant matching, transfer detection, dedup)
- `src/lib/utils.ts` — `cn()`, `formatCurrency()`, `formatDate()`
- `src/components/layout/app-shell.tsx` — Main layout with sidebar, dark mode, mobile nav
- `src/middleware.ts` — Pass-through (no auth check, just NextResponse.next())
- `next.config.js` — CSP headers, typescript/eslint ignore settings
- `prisma/schema.prisma` — All 16+ database models

---

## THINGS TO BE CAREFUL ABOUT

1. **Don't change middleware.ts auth logic** — we fought a redirect loop for hours, the current pass-through approach works
2. **Don't change the auth pattern** — Plaid routes use `auth()`, other routes use `requireAuth()`, both work
3. **Don't upgrade to Next 15 or Prisma 7** — would require major refactoring
4. **Don't set `strict: true`** in tsconfig — hundreds of implicit any errors
5. **Don't set `ignoreBuildErrors: false`** in next.config.js — Prisma type errors will break the build
6. **Always run `npx prisma db push`** before deploying schema changes
7. **CSP headers in next.config.js** block external scripts — must whitelist any CDN domains
8. **The .env file** in the local project has real database credentials — never commit it (it's in .gitignore)

---

## ORIGINAL HTML APP REFERENCE

The complete feature reference for the original HTML app is in the project knowledge as `FUTURE-SIGHT-COMPLETE-REFERENCE.md`. This documents all 24 feature areas in detail including:
- Exact transaction object shape
- Import pipeline 3-phase flow
- Sankey 4-column layout with data flow
- All achievement definitions (18 standard + 7 debt + 16 hidden)
- Category system with keyword map
- Transfer/debt payment/return pairing systems
- Health score 6-component formula
- Budget upcoming expenses tracker

The original HTML app source is also in project knowledge as `future-sight.html`.
