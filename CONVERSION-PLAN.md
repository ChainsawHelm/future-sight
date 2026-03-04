# Future Sight — Full-Stack Conversion Plan

## Stack Decision
- **Backend:** Next.js 14 (App Router) — fullstack React framework
  - Why: SSR/SSG for performance, API routes built-in, middleware for auth, 
    React Server Components, excellent security defaults (CSRF, CSP headers)
  - TypeScript throughout for type safety
- **Database:** PostgreSQL via Prisma ORM
  - Why: ACID compliance critical for financial data, strong typing with Prisma,
    migrations, connection pooling, battle-tested at scale
- **Auth:** NextAuth.js v5 (Auth.js)
  - Email + password (bcrypt hashing, JWT sessions)
  - OAuth providers (Google, GitHub)
  - CSRF protection, secure cookies, session management
- **Frontend:** React 18 + Tailwind CSS + shadcn/ui
  - Preserves existing UI design language (dark navy theme)
  - Component library for consistent, accessible UI
- **Deployment:** Docker Compose + standalone package

---

## Phase Breakdown (Save Points)

### PHASE 1: Project Scaffold ✦ SAVE POINT 1
- [x] Next.js 14 project with TypeScript
- [x] Prisma schema (all database tables)
- [x] Docker Compose (app + PostgreSQL)
- [x] Environment config (.env.example)
- [x] Package.json with all dependencies
- [x] Tailwind + shadcn/ui config
- **Deliverable:** Bootable project skeleton, `docker compose up` works

### PHASE 2: Database Schema + Auth ✦ SAVE POINT 2 ✅
- [x] Complete Prisma schema matching all state objects
- [x] NextAuth configuration (email + Google + GitHub)
- [x] Auth middleware protecting all routes
- [x] Login/Register pages
- [x] Session management
- [x] App shell (sidebar + mobile nav + dark mode)
- [x] Dashboard placeholder page
- [x] API auth helper (requireAuth)
- **Deliverable:** Working auth flow, protected routes, app shell

### PHASE 3: Core API Routes ✦ SAVE POINT 3 ✅
- [x] Transactions CRUD + bulk import + bulk update/delete
- [x] Categories management
- [x] Merchant rules (single + bulk upsert)
- [x] Import history (with cascade delete)
- [x] Input validation (zod — all schemas)
- **Deliverable:** Full REST API for core data

### PHASE 4: Financial Feature APIs ✦ SAVE POINT 3 ✅ (merged)
- [x] Savings goals + contributions
- [x] Debt tracker
- [x] Assets
- [x] Net worth snapshots
- [x] Budgets (single + bulk upsert)
- [x] Calendar events
- [x] Subscriptions
- [x] User settings
- [x] Dashboard aggregation endpoint
- [x] Backup/restore (full JSON export/import)
- **Deliverable:** Complete backend for all financial features

### PHASE 5: Frontend — Layout + Dashboard + Transactions ✦ SAVE POINT 5 ✅
- [x] 5a: API client, typed fetch hooks, shared components (StatCard, Amount, CategoryBadge, Spinner, EmptyState, ErrorAlert)
- [x] 5b: Dashboard view (stat cards, spending bars, goal progress, debt/asset summary)
- [x] 5c: Transactions view (sortable table, search, filters, inline edit, bulk actions, pagination)
- [x] 5d: Import pipeline (CSV upload, client-side parsing, review table, category assignment, confirm)
- **Deliverable:** Working dashboard + transactions + import

### PHASE 6: Frontend — All Views ✦ SAVE POINT 6 ✅
- [x] 6a: Goals (add, contribute, progress, delete), Debts (add, amortization calc, payoff), Net Worth (assets CRUD, snapshots)
- [x] 6b: Budget (per-category limits, spending bars, over-budget), Subscriptions (toggle, totals), Calendar (month grid, events)
- [x] 6c: Insights (top merchants, breakdown, trends, largest), Health Score (SVG gauge, 4 components), Heatmap (365-day grid)
- [x] 6d: Reports (monthly/yearly, CSV export), YoY (multi-year table), Achievements (12 milestones), Settings (dark mode, backup/restore)
- **Deliverable:** Feature-complete frontend — all 16 views

### PHASE 7: Security Hardening + Polish ✦ SAVE POINT 7 ✅
- [x] CSP headers (strict Content-Security-Policy)
- [x] HSTS enforcement (Strict-Transport-Security)
- [x] Rate limiting on all endpoints (per-user + per-IP, 5 tiers)
- [x] Input sanitization (XSS prevention, defense-in-depth)
- [x] SQL injection prevention (Prisma parameterized queries — built-in)
- [x] Seed data command (12 months realistic data, demo user)
- [x] Production README with setup, API reference, security docs
- [x] Updated .env.example
- **Deliverable:** Production-ready, secure application

---
## ✅ CONVERSION COMPLETE

---

## Database Tables (from state object analysis)
- users
- transactions
- categories (per-user)
- merchant_rules (per-user)
- import_history
- savings_goals
- goal_contributions
- debts
- assets
- net_worth_snapshots
- budgets
- calendar_events
- subscriptions
- achievements
- user_settings
