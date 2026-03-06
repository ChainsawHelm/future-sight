# Future Sight — Security Architecture

Last updated: 2026-03-06

---

## 1. Encryption

### Plaid Access Tokens
- **Algorithm:** AES-256-GCM (authenticated encryption)
- **Key derivation:** SHA-256 hash of `ENCRYPTION_KEY` environment variable (32-byte output)
- **IV:** 12 random bytes per encryption (never reused)
- **Auth tag:** 16 bytes (GCM integrity verification)
- **Storage format:** `base64(iv):base64(ciphertext):base64(tag)`
- **Enforcement:** The app refuses to store Plaid tokens if `ENCRYPTION_KEY` is not set or if encryption produces an unexpected format
- **Location:** `src/lib/encryption.ts`

### OAuth Tokens (Google/GitHub)
- Access tokens, refresh tokens, and ID tokens from OAuth providers are encrypted with the same AES-256-GCM scheme before being persisted via the NextAuth JWT callback
- **Location:** `src/lib/auth.ts` (jwt callback)

### Client-Side Backup Encryption
- **Algorithm:** AES-256-GCM with PBKDF2 key derivation
- **PBKDF2 iterations:** 600,000 (OWASP 2023 recommendation)
- **Salt:** 16 random bytes per backup
- **IV:** 12 random bytes per backup
- Password never leaves the browser — all encryption/decryption happens client-side via Web Crypto API
- **Location:** `src/lib/backup-crypto.ts`

---

## 2. Authentication & Session Management

### NextAuth v5 Configuration
- **Session strategy:** JWT (stateless, no server-side session store)
- **Password hashing:** bcrypt with salt factor 12
- **Session max age:** 4 hours (reduced from default 30 days for financial app security)
- **Sliding window:** 15-minute `updateAge` — session refreshes on activity
- **Account lockout:** 5 failed login attempts per email per 15 minutes
- **Cookie settings:**
  - `httpOnly: true` (not accessible to JavaScript)
  - `sameSite: 'strict'` (blocks cross-origin cookie sending)
  - `secure: true` in production (HTTPS only)
  - Cookie name prefixed with `__Secure-` in production
- **OAuth:** Optional Google and GitHub OAuth (tokens encrypted before storage)
- **Location:** `src/lib/auth.ts`

### Session Guard (Idle Timeout)
- Screen locks after **15 minutes** of inactivity (blur overlay with lock icon)
- Full automatic sign-out after **30 minutes** of inactivity
- Tracks activity via mousedown, keydown, scroll, touchstart events
- Re-checks on tab visibility change (switching tabs, minimizing)
- **Location:** `src/components/shared/session-guard.tsx`

### Sensitive Action Protection
- Operations like connecting a bank account (Plaid) and deleting an account require a **fresh session** (activity within the last 5 minutes)
- If the session is stale, the user must re-authenticate
- **Location:** `src/lib/sensitive-action.ts`

---

## 3. CSRF Protection

- All state-changing API requests (POST, PATCH, DELETE) must include the header `X-Requested-With: FutureSight`
- This header cannot be set by cross-origin HTML forms, effectively blocking CSRF attacks
- The API client (`src/lib/api-client.ts`) automatically includes this header on every request
- Read operations (GET) are exempt since they don't change state
- **Location:** `src/lib/api-auth.ts` (`verifyCsrfHeader`)

---

## 4. Rate Limiting

### Middleware-Level (IP-Based)
- **Auth routes** (`/api/auth/*`): 20 requests per 5 minutes per IP
- **Global API**: 300 requests per minute per IP
- **Location:** `src/middleware.ts`

### User-Level (Per-Endpoint)
- **Read operations:** 120 requests/minute
- **Write operations:** 60 requests/minute
- **Bulk operations:** 10 requests/minute
- **Backup operations:** 5 requests/5 minutes
- **Plaid operations:** 10 requests/minute
- Sliding window algorithm with in-memory storage
- **Location:** `src/lib/rate-limit.ts`

---

## 5. Input Sanitization

### Sanitization Functions
- **HTML tag stripping:** Removes all `<...>` patterns
- **Script pattern removal:** Blocks `javascript:`, `data:` URIs, and `on*=` event handlers
- **Control character removal:** Strips ASCII control characters (preserves newlines/tabs for note fields)
- **Unicode normalization:** NFKC normalization to prevent lookalike/homoglyph attacks
- **Location:** `src/lib/sanitize.ts`

### Applied To
- Transaction fields: description, originalDescription, category, account, note
- Bulk transaction imports
- Waitlist items: name, category
- Backup restore: all string fields
- URL validation: only `http:` and `https:` protocols allowed

### Schema Validation
- All API routes use **Zod** schemas for request body validation
- Strict typing on all fields with max length constraints

---

## 6. Route Parameter Validation

- All dynamic route parameters (e.g., transaction IDs) are validated against a CUID regex: `/^[a-z0-9]{20,30}$/`
- Invalid IDs return 400 immediately, preventing injection via URL parameters
- **Location:** `src/lib/validate-id.ts`

---

## 7. Account Deletion Safety

- Deletion is not immediate — a **24-hour cooldown** is enforced
- `DELETE /api/account/delete` schedules deletion (sets `scheduledDeletion` timestamp)
- `PATCH /api/account/delete` cancels a scheduled deletion
- `GET /api/account/delete` checks deletion status
- Requires exact confirmation string: `"DELETE MY ACCOUNT"`
- Requires fresh session (authenticated within last 5 minutes)
- During the cooldown, all API access is blocked (403) explaining the account is pending deletion
- Audit logged
- **Location:** `src/app/api/account/delete/route.ts`, `src/lib/api-auth.ts`

---

## 8. HTTP Security Headers

All headers are set in `next.config.js` and apply to every route:

| Header | Value | Purpose |
|--------|-------|---------|
| `X-Frame-Options` | `DENY` | Prevents clickjacking via iframes |
| `X-Content-Type-Options` | `nosniff` | Prevents MIME-type sniffing |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Controls referrer leakage |
| `X-XSS-Protection` | `1; mode=block` | Legacy XSS filter |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=()` | Disables unnecessary browser APIs |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` | Forces HTTPS for 1 year |
| `X-DNS-Prefetch-Control` | `on` | Enables DNS prefetching |

### Content Security Policy

```
default-src 'self';
script-src 'self' 'unsafe-inline' https://cdn.plaid.com;
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
font-src 'self' https://fonts.gstatic.com;
img-src 'self' data: blob: https:;
connect-src 'self' https://*.plaid.com;
frame-src https://*.plaid.com;
frame-ancestors 'none';
form-action 'self';
base-uri 'self';
object-src 'none';
upgrade-insecure-requests
```

---

## 9. Audit Logging

### Tracked Events
- `login` / `login_failed` — authentication attempts
- `register` — new account creation
- `export_backup` / `restore_backup` — data export/import
- `reset_data` — data wipe
- `delete_account` — account deletion request
- `plaid_connect` / `plaid_disconnect` / `plaid_sync` — bank connection events
- `password_change` — credential changes

### Log Fields
- `userId` — who performed the action
- `action` — event type
- `detail` — additional context (max 500 chars, sanitized)
- `ip` — client IP (from `x-forwarded-for` or `x-real-ip`)
- `createdAt` — timestamp

### Design
- Non-blocking — audit failures never break the main operation
- Stored in PostgreSQL via Prisma (`AuditLog` model)
- **Location:** `src/lib/audit.ts`

---

## 10. Environment Validation

- The app validates required environment variables on server startup via Next.js instrumentation hook
- **Required:** `DATABASE_URL`, `NEXTAUTH_SECRET`, `ENCRYPTION_KEY`
- **Production-only:** `NEXTAUTH_URL`
- `ENCRYPTION_KEY` must be at least 32 characters
- App refuses to start if any check fails
- **Location:** `src/lib/env-check.ts`, `src/instrumentation.ts`

---

## 11. Plaid Integration

### How Plaid Works
1. User clicks "Connect Bank Account" — server creates a Plaid Link token
2. Plaid Link opens in the browser — user authenticates directly with their bank through Plaid's UI
3. On success, Plaid returns a `public_token` (temporary, single-use)
4. Server exchanges it for an `access_token` (long-lived, encrypted before storage)
5. Access token is used to sync transactions and account balances

### Plaid Security Measures
- **Future Sight never sees bank credentials** — authentication happens entirely within Plaid's iframe
- **Access tokens are encrypted at rest** using AES-256-GCM
- **Plaid Link uses HTTPS** and loads from `cdn.plaid.com` (whitelisted in CSP)
- **API calls to Plaid** use server-side credentials — never exposed to the browser
- **Rate limited:** 10 requests/minute per user
- **Fresh session required** to connect a new bank
- **Unlinking** calls `plaid.itemRemove()` to revoke the token on Plaid's end, then deletes encrypted token and all account metadata from the database
- **Environment:** Production (real bank connections)

---

## 12. File Upload Validation

- PDF imports require `.pdf` extension and `application/pdf` MIME type
- Maximum file size: 10 MB
- Parsed output validated via Zod schema
- **Location:** `src/app/api/parse-pdf/route.ts`

---

## 13. Dependency Security

- GitHub Dependabot scans npm dependencies weekly and opens PRs for vulnerable packages
- **Location:** `.github/dependabot.yml`

---

## 14. Data Storage

### What We Store Per User
| Data | Details |
|------|---------|
| Account info | Name, email, bcrypt-hashed password (salt 12) |
| Transactions | Date, description, amount, category, account |
| Financial records | Debts, assets, goals, budgets, subscriptions, calendar events |
| Net worth | Periodic snapshots |
| Plaid tokens | AES-256-GCM encrypted access tokens |
| Plaid account metadata | Account name, type, last 4 digits, balances |
| Audit logs | Action type, timestamp, IP address |

### What We Do NOT Store
- Bank login credentials (handled entirely by Plaid)
- Full account numbers
- Social security numbers
- Any PII beyond name and email

---

## 15. Incident Response

- A detailed incident response plan is maintained at `INCIDENT-RESPONSE-PLAN.md`
- Covers: severity definitions (SEV-1 through SEV-4), breach response procedures, communication templates, regulatory requirements (GDPR 72-hour notification, CCPA), and post-mortem process

---

## Infrastructure

| Component | Provider | Security Notes |
|-----------|----------|---------------|
| Hosting | Vercel | Edge network, automatic HTTPS, DDoS protection |
| Database | Supabase (PostgreSQL) | Encrypted at rest, SSL connections |
| Bank Data | Plaid | Tokens encrypted before storage, never logged |
| Auth | NextAuth v5 | JWT with strict cookie settings |
| Domain | futuresightfinance.com | HSTS preload, forced HTTPS |

---

## Reporting Security Issues

If you find a security vulnerability, please report it responsibly by contacting the repository owner directly rather than opening a public issue.
