# Future Sight — Security & Privacy

## Overview

Future Sight is a personal finance tracker. This document covers how user data is handled, how Plaid integration works, and what security measures are in place.

## Data Storage

- **Database:** PostgreSQL hosted on Supabase (AWS infrastructure)
- **Hosting:** Vercel (serverless functions + static assets)
- **Domain:** futuresightfinance.com (HTTPS enforced via HSTS)

### What We Store Per User

| Data | Details |
|------|---------|
| Account info | Name, email, bcrypt-hashed password (salt 12) |
| Transactions | Date, description, amount, category, account |
| Financial records | Debts, assets, goals, budgets, subscriptions, calendar events |
| Net worth | Periodic snapshots |
| Plaid tokens | AES-256-GCM encrypted access tokens |
| Plaid account metadata | Account name, type, last 4 digits, balances |

### What We Do NOT Store

- Bank login credentials (handled entirely by Plaid)
- Full account numbers
- Social security numbers
- Any PII beyond name and email

## Authentication

- **Provider:** NextAuth v5 (Auth.js) with JWT session strategy
- **Password hashing:** bcrypt with salt factor 12
- **Session expiry:** 7 days
- **Account lockout:** 5 failed login attempts per email per 15 minutes
- **Rate limiting:** IP-based rate limiting on login (10/min) and registration (5/min)
- **OAuth:** Optional Google and GitHub OAuth (if configured)

## API Security

- **Authentication:** Every API route requires a valid JWT session
- **Rate limiting:** All API endpoints have per-user rate limits:
  - Read operations: 120 requests/minute
  - Write operations: 60 requests/minute
  - Bulk operations: 10 requests/minute
  - Backup/restore: 5 requests per 5 minutes
  - Plaid operations: 10 requests/minute
- **Input validation:** All API inputs validated with Zod schemas (type checking, length limits, regex patterns)
- **Data isolation:** Every database query filters by `userId` — users can only access their own data
- **Destructive operations:** The data reset endpoint requires explicit confirmation string

## Plaid Integration

### How Plaid Works

1. User clicks "Connect Bank Account" — we create a Plaid Link token (server-side)
2. Plaid Link opens in the browser — user authenticates directly with their bank through Plaid's UI
3. On success, Plaid gives us a `public_token` (temporary, single-use)
4. We exchange it server-side for an `access_token` (long-lived, stored encrypted)
5. We use the `access_token` to sync transactions and account balances

### Plaid Security Measures

- **Future Sight never sees bank credentials** — authentication happens entirely within Plaid's iframe
- **Access tokens are encrypted at rest** using AES-256-GCM with a server-side encryption key
- **Plaid Link uses HTTPS** and loads from `cdn.plaid.com` (whitelisted in our CSP)
- **API calls to Plaid** use server-side credentials (`PLAID_CLIENT_ID` + `PLAID_SECRET`) — never exposed to the browser
- **Rate limited:** Plaid API operations are rate-limited to prevent abuse
- **Unlinking:** Users can unlink any bank connection at any time, which:
  - Calls `plaid.itemRemove()` to revoke the access token on Plaid's end
  - Deletes the encrypted token and all account metadata from our database

### Plaid Environment

- **Current:** Sandbox (test data only, no real bank connections)
- **Production:** Requires Plaid production approval before handling real bank data
- Plaid environment is configured via `PLAID_ENV` environment variable

### Required Environment Variables for Plaid

```
PLAID_CLIENT_ID=       # From Plaid dashboard
PLAID_SECRET=          # From Plaid dashboard
PLAID_ENV=sandbox      # sandbox | development | production
ENCRYPTION_KEY=        # Random 32+ character string for AES-256-GCM encryption
```

## HTTP Security Headers

| Header | Value |
|--------|-------|
| Content-Security-Policy | Strict CSP with `unsafe-eval` removed in production |
| Strict-Transport-Security | 1 year, includeSubDomains, preload |
| X-Frame-Options | DENY |
| X-Content-Type-Options | nosniff |
| Referrer-Policy | strict-origin-when-cross-origin |
| Permissions-Policy | camera=(), microphone=(), geolocation=(), payment=() |
| X-XSS-Protection | 1; mode=block |

## CSP Details

```
default-src 'self'
script-src 'self' 'unsafe-inline' https://cdn.plaid.com
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com
font-src 'self' https://fonts.gstatic.com
connect-src 'self' https://*.plaid.com
frame-src https://*.plaid.com
frame-ancestors 'none'
form-action 'self'
base-uri 'self'
object-src 'none'
upgrade-insecure-requests
```

## Environment Variables (Never Committed)

The `.env` file is gitignored and contains:
- Database credentials (Supabase)
- NextAuth secret
- Plaid API keys
- Encryption key
- OAuth client IDs/secrets (optional)

## Reporting Security Issues

If you find a security vulnerability, please report it responsibly by contacting the repository owner directly rather than opening a public issue.
