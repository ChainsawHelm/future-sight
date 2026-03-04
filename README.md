# Future Sight

A secure, self-hostable personal finance tracker built with modern web technologies.

## Features

- **Dashboard** — Net worth, monthly income/spending, savings rate, category breakdown
- **Transactions** — Sortable table with inline editing, search, filters, bulk actions
- **Import** — CSV bank statement import with auto-column detection
- **Goals** — Savings goals with contributions and progress tracking
- **Debt Tracker** — Amortization calculator, payoff projections
- **Net Worth** — Asset management, liability tracking, snapshot history
- **Budget** — Per-category limits with real-time spending comparison
- **Subscriptions** — Recurring cost tracking with monthly/yearly totals
- **Calendar** — Monthly bill/payday event grid
- **Insights** — Top merchants, spending patterns, trends
- **Health Score** — Composite 0-100 financial health rating
- **Heatmap** — 365-day spending intensity grid
- **Reports** — Monthly/yearly summaries with CSV export
- **Year-over-Year** — Multi-year comparison tables
- **Achievements** — 12 gamified financial milestones
- **Settings** — Dark mode, backup/restore, data management

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Database | PostgreSQL 16 |
| ORM | Prisma 6 |
| Auth | NextAuth.js v5 |
| UI | React 18 + Tailwind CSS |
| Validation | Zod |
| Deployment | Docker + Docker Compose |

## Quick Start

### Docker (recommended)

```bash
cp .env.example .env
# Edit .env — set DATABASE_URL and NEXTAUTH_SECRET (openssl rand -base64 32)
docker compose up -d
docker compose exec app npx prisma db seed  # optional demo data
# Open http://localhost:3000
```

### Local Development

```bash
npm install
cp .env.example .env
# Edit .env — need a running PostgreSQL
npx prisma migrate dev
npm run db:seed  # optional
npm run dev
```

### Demo Account

After seeding: **demo@futuresight.app** / **Demo1234** — includes 12 months of transactions, goals, debts, budgets, and more.

## Security

- bcrypt (12 rounds), JWT sessions, CSRF protection
- Per-user data isolation on every query
- Rate limiting: auth (5-10/min), API reads (120/min), writes (60/min), bulk (10/min)
- Zod validation + HTML sanitization on all inputs
- SQL injection prevention (Prisma parameterized queries)
- CSP, HSTS, X-Frame-Options DENY, X-Content-Type-Options

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `NEXTAUTH_SECRET` | Yes | Session encryption key |
| `NEXTAUTH_URL` | Yes | Application URL |
| `GOOGLE_CLIENT_ID` | No | Google OAuth |
| `GOOGLE_CLIENT_SECRET` | No | Google OAuth |
| `GITHUB_CLIENT_ID` | No | GitHub OAuth |
| `GITHUB_CLIENT_SECRET` | No | GitHub OAuth |

## License

Private. All rights reserved.
