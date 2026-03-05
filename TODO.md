# Future Sight — Remaining Development & Security To-Do

## App Features (remaining)

### High Priority
- [ ] Transaction quick-sort date presets (1d / 7d / 30d / 3m / 6m / YTD / last year / per-year chunks)
- [ ] Debt panel condense + interest rate display

### Medium Priority
- [ ] Net worth time tabs (1y / 5y / 10y) on net worth view
- [ ] Asset sparklines — small value-history line graphs inside each asset card
- [ ] Goals projections — months-to-goal calculation based on current pace

### Lower Priority
- [ ] Debt amortization — snowball/avalanche payoff schedule

---

## Security Lockdown (do in this order)

### 1. Plaid
- [ ] Rotate Plaid client secret if it has ever appeared in any commit, log, or shared screen
- [ ] Keep PLAID_ENV=sandbox until Plaid production review is complete
- [ ] Enable Supabase RLS on plaid_items table so users can only read their own rows
- [ ] When adding webhooks: verify Plaid-Verification header on every webhook request
- [ ] Confirm access tokens never reach the client (currently correct — keep it that way)

### 2. Supabase (most impactful quick win)
- [ ] Enable Row Level Security (RLS) on ALL tables
  - Dashboard > Database > Tables > each table > Enable RLS
  - Add policy: auth.uid() = user_id (or disable PostgREST entirely since you only use Prisma)
- [ ] Rotate DATABASE_URL / DIRECT_URL if either has ever appeared in a commit
- [ ] Disable the Supabase Data API (PostgREST) — not used, unused attack surface
  - Project Settings > API > disable
- [ ] Set up Supabase backups (Point-in-Time Recovery or daily schedule)

### 3. Vercel
- [ ] Audit environment variables — ensure secrets are scoped to "Production" only, NOT "Preview" or "Development"
- [ ] Disable or restrict Preview deployments — Project Settings > Git > "Only deploy from protected branches"
- [ ] Enable Vercel DDoS/bot protection — Project Settings > Security
- [ ] Confirm NEXTAUTH_URL = https://futuresightfinance.com (exact, no trailing slash)
- [ ] Verify security headers in next.config.js:
  - X-Frame-Options: DENY
  - X-Content-Type-Options: nosniff
  - Referrer-Policy: strict-origin-when-cross-origin
- [ ] Rotate NEXTAUTH_SECRET — generate with: openssl rand -base64 32
  (invalidates all existing sessions — users re-login once)

### 4. GitHub
- [ ] Scan git history for secrets: git log --all --full-history -- .env
- [ ] Run truffleHog or enable GitHub Secret Scanning (repo Settings > Security & Analysis)
- [ ] Enable GitHub Push Protection to block future accidental key commits
- [ ] Enable Dependabot alerts + security updates
- [ ] Branch protection on main:
  - Require PR review before merge
  - Disallow force-push
  - Require status checks
- [ ] Rotate any personal access tokens tied to this repo
- [ ] Enable 2FA on GitHub account if not already done

### 5. NextAuth / App-Level
- [ ] Tighten session expiry — consider 7 days instead of default 30 (finance app)
- [ ] Rate-limit /api/auth/signin to prevent brute force
- [ ] Remove or make read-only the demo account (demo@futuresight.app) before going fully public
- [ ] Audit all API routes — verify every route calls requireAuth() at the top
  - Quick check: grep -r "export async function" src/app/api --include="*.ts" | grep -v requireAuth

---

## Pre-Launch Checklist
- [ ] Run npm audit — fix high/critical vulnerabilities
- [ ] End-to-end test with real Plaid sandbox account
- [ ] Apply for Plaid production access (requires privacy policy + terms of service pages)
- [ ] Add /privacy and /terms pages (required by Plaid for production)
- [ ] Set up error monitoring — Sentry free tier (@sentry/nextjs)
- [ ] Performance audit with Vercel Analytics or Lighthouse
