# Future Sight Finance — Incident Response Plan

**Owner:** [Your Name]
**Last reviewed:** March 5, 2026
**Review cadence:** Every 6 months or after any incident

---

## 1. Definitions

| Severity | Description | Examples | Response Time |
|----------|-------------|----------|---------------|
| **SEV-1 (Critical)** | Active data breach, financial data exposed, or service completely down | Plaid tokens leaked, database dumped, auth bypass discovered | Immediate (within 1 hour) |
| **SEV-2 (High)** | Potential breach, partial outage, or vulnerability actively exploited | Suspicious API access patterns, Supabase credentials exposed in logs, elevated error rates on Plaid routes | Within 4 hours |
| **SEV-3 (Medium)** | Vulnerability discovered but not exploited, minor data issue | Dependency CVE, user reports seeing another user's data, failed Plaid syncs for multiple users | Within 24 hours |
| **SEV-4 (Low)** | Minor issue, no data at risk | UI bug exposing no sensitive data, non-critical feature broken, single user sync failure | Within 72 hours |

---

## 2. Incident Response Team

Since Future Sight is a solo-operated application, all roles are held by the operator:

| Role | Responsibility | Contact |
|------|---------------|---------|
| **Incident Commander** | You — makes all decisions, coordinates response | Your personal phone + email |
| **Backup Contact** | [Designate a trusted person who can access infrastructure if you're unreachable] | Their phone + email |

### Access Inventory

Ensure you can reach all of these within minutes:

| Service | URL | What It Controls |
|---------|-----|-----------------|
| Vercel | vercel.com/dashboard | App hosting, environment variables, deployments |
| Supabase | supabase.com/dashboard | Database, all user data, Plaid tokens |
| GitHub | github.com/ChainsawHelm/future-sight | Source code, deployment pipeline |
| Plaid | dashboard.plaid.com | Bank connections, API keys |
| Stripe | dashboard.stripe.com | Payments, customer billing data |
| Google Cloud Console | console.cloud.google.com | OAuth credentials |
| GitHub OAuth Settings | github.com/settings/developers | OAuth credentials |
| Upstash | console.upstash.com | Redis rate limiting |
| Sentry | sentry.io | Error monitoring, alerts |
| Domain Registrar | [wherever futuresightfinance.com is registered] | DNS, domain control |
| Email | [wherever support@futuresightfinance.com is hosted] | User communications |

---

## 3. Detection

### How You'll Know Something Is Wrong

| Source | What It Catches |
|--------|----------------|
| **Sentry alerts** | Unhandled exceptions, elevated error rates, Plaid/Stripe API failures |
| **Supabase dashboard** | Unusual query patterns, connection spikes, storage anomalies |
| **Vercel logs** | Failed deployments, function timeouts, elevated 4xx/5xx rates |
| **Upstash dashboard** | Rate limit hits, unusual traffic patterns |
| **Plaid dashboard** | Webhook failures, elevated error rates, institution issues |
| **Stripe dashboard** | Failed charges, dispute spikes, webhook failures |
| **User reports** | Emails to support@futuresightfinance.com |
| **GitHub** | Dependabot alerts, security advisories |
| **Manual audit** | Weekly review of audit_log table for anomalies |

### Set Up These Alerts (Action Items)

- [ ] Sentry: alert on any unhandled exception (email + push notification)
- [ ] Sentry: alert when error rate exceeds 5% of requests in 10 minutes
- [ ] Vercel: enable deployment failure notifications
- [ ] Supabase: enable email alerts for database health
- [ ] Upstash: alert when rate limit blocks exceed 100/hour (possible attack)
- [ ] Stripe: enable email alerts for failed payments and disputes
- [ ] GitHub: enable Dependabot alerts and security advisories
- [ ] Set a weekly calendar reminder to review the audit_log table

---

## 4. Response Procedures

### 4.1 — Confirmed Data Breach (SEV-1)

**Someone has accessed user financial data, Plaid tokens, or database contents.**

**Contain (first 30 minutes):**

1. Rotate ALL secrets immediately:
   - Supabase: regenerate database password (Project Settings > Database)
   - Plaid: rotate API keys (Plaid Dashboard > Keys)
   - Stripe: roll API keys (Stripe Dashboard > Developers > API Keys)
   - NextAuth: generate new `NEXTAUTH_SECRET` (run `openssl rand -base64 32`)
   - OAuth: regenerate Google and GitHub OAuth client secrets
   - Upstash: rotate Redis credentials
2. Push new secrets to Vercel environment variables
3. Redeploy the application (`vercel --prod` or push empty commit)
4. If database is compromised:
   - Export current data as evidence
   - Revoke all Plaid access tokens: call `plaid.itemRemove()` for every item
   - Consider pausing the app (Vercel > Project Settings > Pause)

**Assess (next 2 hours):**

5. Determine scope:
   - Which users are affected?
   - What data was accessed? (transactions, balances, account numbers, emails?)
   - How did the attacker get in? (stolen credentials, SQL injection, API vulnerability, Supabase misconfiguration?)
   - Is the attack still ongoing?
6. Preserve evidence:
   - Export Vercel function logs for the incident timeframe
   - Export Supabase query logs
   - Screenshot Sentry error timeline
   - Export audit_log table entries around the incident
   - Save copies of everything — do not modify or delete logs

**Notify (within 72 hours for GDPR, "without unreasonable delay" for CCPA):**

7. Notify affected users via email:
   - What happened (in plain language)
   - What data was affected
   - What you've done to contain it
   - What they should do (monitor bank accounts, consider freezing credit if account numbers exposed)
   - Contact information for questions
8. If EU/EEA users are affected and personal data was compromised:
   - File a report with the relevant Data Protection Authority within 72 hours
   - Document: nature of breach, categories of data, approximate number of users, likely consequences, measures taken
9. If bank account numbers or credentials were exposed:
   - Notify Plaid immediately (security@plaid.com)
   - Plaid will coordinate with affected financial institutions
10. If payment data was exposed:
    - Notify Stripe immediately
    - Stripe handles PCI breach procedures

**Remediate:**

11. Fix the vulnerability that allowed the breach
12. Deploy the fix
13. Conduct a post-mortem (see Section 6)

---

### 4.2 — Plaid Token Compromise (SEV-1)

**Plaid access tokens are exposed (in logs, error messages, git history, etc.).**

1. Immediately revoke ALL compromised access tokens:
   ```
   // For each affected item:
   await plaidClient.itemRemove({ access_token: compromisedToken });
   ```
2. Rotate Plaid API keys in Plaid Dashboard
3. Update Vercel environment variables with new keys
4. Redeploy
5. Notify affected users — they'll need to re-link their bank accounts
6. Audit how tokens were exposed:
   - Check Sentry for tokens in error messages (they should never appear in errors)
   - Check Vercel logs for tokens in request/response logging
   - Check git history for accidentally committed tokens
7. Add safeguards: scrub access tokens from all error handlers and log outputs

---

### 4.3 — Supabase/Database Compromise (SEV-1)

**Unauthorized access to the PostgreSQL database.**

1. Immediately regenerate the database password (Supabase Dashboard > Settings > Database)
2. Update `DATABASE_URL` and `DIRECT_URL` in Vercel environment variables
3. Revoke all Plaid tokens (they're encrypted but the encryption key may be compromised too)
4. Rotate `PLAID_TOKEN_SECRET` and re-encrypt all tokens (this means users must re-link)
5. Check Supabase logs for:
   - Unusual IP addresses
   - Bulk SELECT queries on sensitive tables (plaid_items, users, transactions)
   - Any DDL changes (ALTER TABLE, DROP, etc.)
6. If using Supabase connection pooler: regenerate pooler credentials too
7. Review Row Level Security (RLS) policies — if not enabled, enable them
8. Notify affected users per Section 4.1 steps 7-9

---

### 4.4 — Auth Bypass / Session Hijacking (SEV-1)

**Someone is accessing other users' accounts.**

1. Rotate `NEXTAUTH_SECRET` — this invalidates ALL existing sessions
2. Push to Vercel, redeploy — every user will be logged out
3. Rotate OAuth client secrets (Google + GitHub)
4. Check audit_log for suspicious activity:
   ```sql
   SELECT * FROM audit_log
   WHERE action IN ('ACCOUNT_DELETE', 'BACKUP_RESTORE', 'SETTINGS_UPDATE')
   ORDER BY created_at DESC
   LIMIT 100;
   ```
5. Review the auth vulnerability — check middleware, API routes, session validation
6. Notify affected users

---

### 4.5 — Stripe/Payment Data Issue (SEV-2)

**Disputed charges, payment processing errors, or Stripe webhook compromise.**

1. Check Stripe Dashboard for the scope of the issue
2. If webhook signing secret is compromised:
   - Rotate the webhook signing secret in Stripe Dashboard
   - Update `STRIPE_WEBHOOK_SECRET` in Vercel
   - Redeploy
3. If fraudulent charges occurred:
   - Issue refunds via Stripe Dashboard
   - Stripe handles PCI compliance — follow their guidance
4. Notify affected users about any billing issues

---

### 4.6 — Dependency Vulnerability (SEV-3)

**GitHub Dependabot or npm audit reports a CVE.**

1. Assess: does the vulnerability affect your usage of the package?
   - Read the CVE details — many vulns require specific configurations
   - Check if the vulnerable code path is reachable in your app
2. If exploitable:
   - Update the dependency immediately
   - Test locally, then push
   - If it's a transitive dependency you can't update, check for patches or workarounds
3. If not exploitable (like the current Next.js 14 CVEs):
   - Document why it's not exploitable
   - Set a reminder to revisit when upgrading becomes feasible
4. Run `npm audit` monthly

---

### 4.7 — Service Outage (SEV-2/3)

**The app is down or major features are broken.**

| If down... | Check... | Fix... |
|-----------|---------|--------|
| Entire app | Vercel status page, deployment logs | Rollback to last working deployment in Vercel |
| Database | Supabase status page, connection limits | Check if free tier connection limit hit; restart if needed |
| Bank sync | Plaid status page, webhook logs | Usually a Plaid-side issue; wait or check institution status |
| Payments | Stripe status page | Usually a Stripe-side issue; wait |
| Auth | Google/GitHub OAuth status | Check if OAuth credentials expired or were revoked |

**If you need to take the app offline intentionally:**
1. Add a maintenance page (Vercel > Edge Config or redirect rule)
2. Post on any status channel you have
3. Fix the issue
4. Remove maintenance page
5. Post resolution

---

## 5. Communication Templates

### User Notification Email — Data Breach

```
Subject: Important Security Notice from Future Sight Finance

Hi [Name],

We're writing to inform you of a security incident that may have
affected your Future Sight Finance account.

WHAT HAPPENED:
[Brief, honest description of what occurred and when]

WHAT DATA WAS INVOLVED:
[Specific list: email, transaction history, account balances, etc.]

WHAT WE'VE DONE:
- [Action 1: e.g., "Rotated all security credentials"]
- [Action 2: e.g., "Revoked all bank connections as a precaution"]
- [Action 3: e.g., "Patched the vulnerability that allowed this"]

WHAT YOU SHOULD DO:
- Monitor your bank accounts for unauthorized activity
- [If bank account numbers exposed: "Consider placing a fraud alert
  with the credit bureaus"]
- You will need to re-link your bank accounts in Future Sight

We take the security of your financial data seriously, and we sincerely
apologize for this incident. If you have questions, reply to this email
or contact us at support@futuresightfinance.com.

[Your Name]
Future Sight Finance
```

### User Notification — Planned Maintenance

```
Subject: Scheduled Maintenance — [Date, Time]

Hi,

Future Sight Finance will be briefly unavailable on [date] from
[start time] to [estimated end time] (EST) for [reason].

Your data is safe — no action is needed on your part. The app will
be back online automatically.

Thanks for your patience.
```

---

## 6. Post-Incident Review

After any SEV-1 or SEV-2 incident, write a post-mortem within 7 days. Store it in the project repo under `/incident-reports/YYYY-MM-DD-title.md`.

### Post-Mortem Template

```markdown
# Incident Report: [Title]

**Date:** [When it happened]
**Duration:** [How long until resolved]
**Severity:** [SEV-1/2/3]
**Author:** [Your name]

## Summary
[2-3 sentences: what happened, what was the impact]

## Timeline
- HH:MM — [Event]
- HH:MM — [Event]
- HH:MM — [Resolution]

## Root Cause
[What actually caused the incident]

## Impact
- Users affected: [number]
- Data exposed: [what, if anything]
- Duration: [how long]

## What Went Well
- [Thing that helped]

## What Went Wrong
- [Thing that made it worse or slower to resolve]

## Action Items
- [ ] [Preventive measure 1]
- [ ] [Preventive measure 2]
- [ ] [Detection improvement]
```

---

## 7. Preventive Measures Checklist

### Already Implemented
- [x] OAuth-only authentication (no password database)
- [x] Plaid tokens encrypted with AES-256-GCM at rest
- [x] Audit logging on sensitive operations
- [x] HTTPS everywhere (Vercel)
- [x] CSP headers
- [x] Backup checksum verification
- [x] API input sanitization on restore
- [x] Cookie consent (GDPR)
- [x] Privacy Policy and Terms of Service

### To Implement Before Production Plaid
- [ ] Redis-backed rate limiting (Upstash)
- [ ] Error monitoring and alerting (Sentry)
- [ ] Supabase Pro plan with DPA signed
- [ ] Plaid production approval
- [ ] Row Level Security (RLS) on Supabase tables
- [ ] Scrub sensitive data from all error/log outputs
- [ ] Automated database backups (Supabase Pro includes daily backups)
- [ ] Security headers audit (check securityheaders.com)

### Ongoing
- [ ] Monthly `npm audit` review
- [ ] Weekly audit_log table review
- [ ] 6-month review of this incident response plan
- [ ] Annual review of Privacy Policy and Terms of Service
- [ ] Keep all OAuth redirect URIs minimal and exact-match

---

## 8. Regulatory Quick Reference

| Regulation | Applies If... | Key Requirement | Deadline |
|-----------|--------------|----------------|----------|
| **GDPR** | Any EU/EEA user | Notify DPA of breach | 72 hours |
| **CCPA** | California users, 50k+ records/year or $25M+ revenue | Notify users of breach | "Without unreasonable delay" |
| **Plaid Agreement** | Using Plaid | Notify Plaid of any security incident involving their data | Immediately |
| **Stripe Agreement** | Using Stripe | Report compromised payment data | Immediately |
| **State Breach Laws** | US users | Varies by state — most require notification | Typically 30-60 days |

**Note:** If you're under GDPR thresholds (small user base, no EU establishment), the full GDPR breach notification may not apply, but it's best practice to follow it anyway. Consult a lawyer if you're unsure.

---

## 9. Emergency Contacts

| Who | When to Contact | How |
|-----|----------------|-----|
| **Plaid Security** | Any incident involving bank data or Plaid tokens | security@plaid.com |
| **Stripe Support** | Payment data issues | Stripe Dashboard > Support |
| **Supabase Support** | Database compromise or outage | Supabase Dashboard > Support (Pro plan required for priority) |
| **Vercel Support** | Hosting compromise or deployment issues | Vercel Dashboard > Support |
| **Your Lawyer** | Any breach affecting user data | [Add contact info] |
| **Your Backup Contact** | You're unreachable during an incident | [Add contact info] |

---

*This is a living document. Update it as your infrastructure, team, and regulatory obligations evolve.*
