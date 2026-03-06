'use client';

import { useState, useEffect } from 'react';

/* ══════════════════════════════════════════
   CHECKLIST DATA
══════════════════════════════════════════ */

interface ChecklistItem {
  id: string;
  title: string;
  steps: string[];
}

interface ChecklistTier {
  id: string;
  label: string;
  description: string;
  color: string;
  items: ChecklistItem[];
}

const TIERS: ChecklistTier[] = [
  {
    id: 'tier1',
    label: 'Tier 1 — Personal Bank Use',
    description: 'Required before connecting YOUR bank account via Plaid',
    color: 'text-green-400',
    items: [
      {
        id: 't1-env-typo',
        title: 'Fix .env ENCRYPTION_KEY typo',
        steps: [
          'Open your .env file locally',
          'Find the line that says ENCYRPTION_kEY (misspelled)',
          'Rename it to ENCRYPTION_KEY (correct spelling, all caps)',
          'Make sure the value is at least 32 characters long',
          'Restart the dev server to verify it starts without error',
        ],
      },
      {
        id: 't1-vercel-env',
        title: 'Set ENCRYPTION_KEY in Vercel',
        steps: [
          'Go to vercel.com > your project > Settings > Environment Variables',
          'Add ENCRYPTION_KEY with a strong random value (32+ chars)',
          'Use: openssl rand -base64 48 to generate one',
          'Make sure it is set for Production, Preview, and Development',
          'Redeploy the project so it picks up the new variable',
        ],
      },
      {
        id: 't1-plaid-csp',
        title: 'Fix Plaid CSP bug (Plaid Link button does nothing)',
        steps: [
          'Open next.config.js',
          'Find the Content-Security-Policy header',
          'Add https://cdn.plaid.com to the script-src directive',
          'Add https://cdn.plaid.com to the connect-src directive',
          'Redeploy and verify the Plaid Link button opens the modal',
        ],
      },
      {
        id: 't1-plaid-dev',
        title: 'Switch Plaid from sandbox to development',
        steps: [
          'Go to dashboard.plaid.com',
          'Apply for Development access (free, instant approval)',
          'Once approved, get your Development client_id and secret',
          'In .env and Vercel env vars, set PLAID_ENV=development',
          'Update PLAID_CLIENT_ID and PLAID_SECRET with dev credentials',
          'Test with a real bank connection (Chase, BoA, etc.)',
        ],
      },
      {
        id: 't1-npm-audit',
        title: 'Run npm audit and fix vulnerabilities',
        steps: [
          'Run: npm audit',
          'Review the output for critical/high severity issues',
          'Run: npm audit fix to auto-fix what it can',
          'For remaining issues, check if they affect production code',
          'Update specific packages manually if needed',
        ],
      },
      {
        id: 't1-hsts',
        title: 'Enable HSTS preload',
        steps: [
          'Open next.config.js',
          'Find the Strict-Transport-Security header',
          'Change the value to: max-age=63072000; includeSubDomains; preload',
          'Deploy and verify the header is present in browser DevTools > Network',
          'Optionally submit to hstspreload.org for browser preload list',
        ],
      },
    ],
  },
  {
    id: 'tier2',
    label: 'Tier 2 — Multi-User / Legal Liability',
    description: 'Required before other people use the app with their bank data',
    color: 'text-yellow-400',
    items: [
      {
        id: 't2-llc',
        title: 'Form an LLC',
        steps: [
          'Choose your state of incorporation (usually your home state)',
          'File Articles of Organization with the state ($50-$500 depending on state)',
          'Get an EIN from the IRS (free, instant online at irs.gov)',
          'Open a business bank account to separate personal/business finances',
          'Update your app\'s legal entity name in Terms of Service',
        ],
      },
      {
        id: 't2-insurance',
        title: 'Get cyber liability insurance',
        steps: [
          'Search for "cyber liability insurance for startups"',
          'Get quotes from Coalition, Corvus, or Embroker',
          'You need: data breach coverage, regulatory defense, business interruption',
          'Target: $1M coverage minimum for financial data handling',
          'Keep the policy number and carrier contact accessible for incident response',
        ],
      },
      {
        id: 't2-legal',
        title: 'Get lawyer-reviewed Privacy Policy and Terms of Service',
        steps: [
          'The app already has Privacy Policy and ToS pages (basic versions)',
          'Hire a lawyer familiar with fintech / financial data regulations',
          'Have them review for CCPA, GDPR (if serving EU users), and state privacy laws',
          'Ensure the Privacy Policy covers: what data is collected, how it is stored/encrypted, Plaid data usage, third-party sharing, data retention, deletion rights',
          'Ensure ToS covers: limitation of liability, dispute resolution, account termination, acceptable use',
          'Update the pages at /privacy and /terms with the lawyer-reviewed versions',
        ],
      },
      {
        id: 't2-dpa',
        title: 'Sign a DPA with Supabase',
        steps: [
          'Go to supabase.com/legal or contact Supabase support',
          'Request a Data Processing Agreement (DPA)',
          'Supabase Pro plan includes a standard DPA — you may need to upgrade from free tier',
          'Review the DPA to ensure it covers financial data handling requirements',
          'Keep a signed copy in your records',
        ],
      },
      {
        id: 't2-plaid-prod',
        title: 'Apply for Plaid production access',
        steps: [
          'Go to dashboard.plaid.com > Production access',
          'Fill out the application (company info, use case, expected volume)',
          'This can take 1-4 weeks for review',
          'Once approved, update PLAID_ENV=production in Vercel env vars',
          'Update PLAID_CLIENT_ID and PLAID_SECRET with production credentials',
          'Test thoroughly with real bank connections before going live',
        ],
      },
      {
        id: 't2-backups',
        title: 'Set up database backups',
        steps: [
          'Supabase free tier has 7-day automatic backups',
          'Consider upgrading to Pro for point-in-time recovery (PITR)',
          'Set up a weekly pg_dump cron job to an off-site location (S3, Backblaze, etc.)',
          'Test restoring from a backup at least once to verify it works',
          'Document the backup restoration procedure',
        ],
      },
      {
        id: 't2-error-monitoring',
        title: 'Set up error monitoring (Sentry)',
        steps: [
          'Sign up at sentry.io (free tier is sufficient to start)',
          'Install: npm install @sentry/nextjs',
          'Run: npx @sentry/wizard@latest -i nextjs to configure',
          'Add SENTRY_DSN to .env and Vercel env vars',
          'Add sentry.io to CSP connect-src in next.config.js',
          'Deploy and verify errors appear in the Sentry dashboard',
        ],
      },
      {
        id: 't2-uptime',
        title: 'Set up uptime monitoring',
        steps: [
          'Sign up for BetterStack (formerly BetterUptime), Pingdom, or UptimeRobot — all have free tiers',
          'Add a monitor for https://futuresightfinance.com',
          'Add a monitor for https://futuresightfinance.com/api/health (create a simple health endpoint if needed)',
          'Configure alerts to your email and/or phone',
          'Set check interval to 1-5 minutes',
        ],
      },
      {
        id: 't2-supabase-upgrade',
        title: 'Upgrade Supabase from free tier',
        steps: [
          'Go to supabase.com > your project > Billing',
          'Upgrade to Pro plan ($25/month)',
          'Benefits: daily backups with PITR, no pause after 1 week inactivity, DPA available, higher connection limits',
          'This is essential if real users depend on the app being available',
        ],
      },
      {
        id: 't2-data-export',
        title: 'Implement user data export and deletion (CCPA/GDPR)',
        steps: [
          'The app already has backup export in Settings',
          'Verify the export includes ALL user data (transactions, goals, debts, etc.)',
          'The 24h account deletion cooldown is already implemented',
          'Ensure deletion removes ALL user data from the database (cascade deletes)',
          'Test the full flow: export data, request deletion, verify data is gone after 24h',
        ],
      },
      {
        id: 't2-cookie-consent',
        title: 'Verify cookie consent compliance',
        steps: [
          'Audit all cookies your app sets (NextAuth session, theme preferences, etc.)',
          'If you only use strictly necessary cookies (auth session), you may not need a banner',
          'If you add analytics (Google Analytics, Plausible, etc.), you WILL need a cookie consent banner',
          'For EU users (GDPR): consent must be opt-in, not opt-out',
          'Document which cookies are set and their purposes in your Privacy Policy',
        ],
      },
      {
        id: 't2-breach-plan',
        title: 'Create a breach notification plan',
        steps: [
          'Document: who to notify (users, cyber insurance, legal counsel)',
          'CCPA requires notification within 72 hours of discovery',
          'GDPR requires notification within 72 hours to supervisory authority',
          'Prepare a template email for user notification',
          'Keep incident response contacts (lawyer, insurance, Plaid) in a secure document',
          'The INCIDENT-RESPONSE-PLAN.md in your repo is a good start — review and finalize it',
        ],
      },
      {
        id: 't2-audit-retention',
        title: 'Set up audit log retention policy',
        steps: [
          'The app already logs audit events to the AuditLog table',
          'Decide on a retention period (90 days for operational, 1 year for compliance)',
          'Create a scheduled job (Vercel cron or Supabase pg_cron) to purge old logs',
          'Ensure logs do NOT contain sensitive data (tokens, passwords, etc.)',
          'Consider archiving old logs to cold storage before deletion',
        ],
      },
      {
        id: 't2-redis-ratelimit',
        title: 'Upgrade rate limiting to Redis (production-grade)',
        steps: [
          'Current rate limiting uses in-memory Maps (resets on deploy, no cross-instance)',
          'Sign up for Upstash Redis (free tier: 10k commands/day)',
          'Install: npm install @upstash/ratelimit @upstash/redis',
          'Replace the in-memory rate limiter in src/lib/rate-limit.ts with Upstash',
          'Add UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN to env vars',
          'This ensures rate limits persist across deploys and serverless instances',
        ],
      },
      {
        id: 't2-plaid-webhooks',
        title: 'Implement Plaid webhooks',
        steps: [
          'Create an API route at /api/plaid/webhook',
          'Register the webhook URL in your Plaid dashboard',
          'Handle key events: TRANSACTIONS_SYNC, ITEM_ERROR, PENDING_EXPIRATION',
          'Verify webhook signatures using Plaid\'s verification endpoint',
          'Use webhooks to auto-sync new transactions instead of manual refresh',
        ],
      },
      {
        id: 't2-deletion-lockout',
        title: 'Lock out accounts during deletion cooldown',
        steps: [
          'The 24h deletion cooldown is implemented but accounts are still accessible',
          'Add a check in requireAuth() — if user.scheduledDeletion is set, return 403',
          'Show a "Your account is scheduled for deletion" page instead of the dashboard',
          'Allow the user to cancel deletion from that page (PATCH /api/account/delete)',
          'After 24h, run actual deletion (Vercel cron job or check on next login attempt)',
        ],
      },
      {
        id: 't2-vuln-scanning',
        title: 'Set up automated vulnerability scanning',
        steps: [
          'Enable GitHub Dependabot alerts on your repository',
          'Go to repo > Settings > Code security and analysis',
          'Enable: Dependency graph, Dependabot alerts, Dependabot security updates',
          'Optionally add a GitHub Action for npm audit on each PR',
          'Review and address alerts weekly',
        ],
      },
    ],
  },
  {
    id: 'tier3',
    label: 'Tier 3 — Nice to Have',
    description: 'Recommended for mature production apps but not blockers for launch',
    color: 'text-blue-400',
    items: [
      {
        id: 't3-csp-reporting',
        title: 'Set up CSP violation reporting',
        steps: [
          'Sign up for report-uri.com or use Sentry CSP reporting',
          'Add report-uri or report-to directive to your CSP header in next.config.js',
          'Monitor reports for blocked resources or injection attempts',
          'Use reports to fine-tune your CSP policy without breaking functionality',
        ],
      },
      {
        id: 't3-soc2',
        title: 'SOC 2 compliance',
        steps: [
          'This is a major undertaking — only needed if targeting enterprise customers',
          'Engage a SOC 2 readiness assessment firm (Vanta, Drata, or Secureframe can automate)',
          'Takes 3-6 months minimum for initial certification',
          'Focus on Trust Service Criteria: Security, Availability, Confidentiality',
        ],
      },
      {
        id: 't3-pentest',
        title: 'Professional penetration test',
        steps: [
          'Hire a third-party security firm to test your application',
          'Scope: web app pentest + API testing + auth bypass attempts',
          'Budget: $3,000-$15,000 depending on scope',
          'Fix all critical/high findings before launch',
          'Keep the report for compliance documentation',
        ],
      },
      {
        id: 't3-bugbounty',
        title: 'Bug bounty program',
        steps: [
          'Start with a simple security.txt file and responsible disclosure policy',
          'Consider platforms like HackerOne or Bugcrowd later',
          'Set clear scope (what is in/out of bounds)',
          'Define reward amounts (can start with swag or small cash rewards)',
        ],
      },
      {
        id: 't3-mfa',
        title: 'Multi-factor authentication (MFA)',
        steps: [
          'Add TOTP (Google Authenticator) support using a library like otpauth',
          'Store encrypted TOTP secrets in the database',
          'Add MFA setup flow in Settings',
          'Require MFA for sensitive operations (Plaid connect, account delete)',
          'Consider WebAuthn/passkeys as a modern alternative',
        ],
      },
    ],
  },
];

/* ══════════════════════════════════════════
   COMPONENT
══════════════════════════════════════════ */

const STORAGE_KEY = 'fs-launch-checklist';

function loadChecked(): Record<string, boolean> {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

export function LaunchChecklistView() {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setChecked(loadChecked());
  }, []);

  const toggle = (id: string) => {
    setChecked(prev => {
      const next = { ...prev, [id]: !prev[id] };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const toggleExpand = (id: string) => {
    setExpandedItems(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const allIds = TIERS.flatMap(t => t.items.map(i => i.id));
  const totalCount = allIds.length;
  const doneCount = allIds.filter(id => checked[id]).length;
  const pct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-lg font-mono font-bold text-primary tracking-tight">
          To Do Before Launch
        </h1>
        <p className="text-xs text-muted-foreground font-mono mt-1">
          Security and compliance checklist for production readiness
        </p>
      </div>

      {/* Progress bar */}
      <div className="bg-surface-1 border border-border p-3 space-y-2">
        <div className="flex items-center justify-between text-xs font-mono">
          <span className="text-muted-foreground">Progress</span>
          <span className="text-primary">{doneCount}/{totalCount} ({pct}%)</span>
        </div>
        <div className="h-2 bg-background border border-border overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Tiers */}
      {TIERS.map(tier => {
        const tierIds = tier.items.map(i => i.id);
        const tierDone = tierIds.filter(id => checked[id]).length;
        const tierTotal = tierIds.length;

        return (
          <div key={tier.id} className="bg-surface-1 border border-border">
            {/* Tier header */}
            <div className="px-4 py-3 border-b border-border">
              <div className="flex items-center justify-between">
                <h2 className={`text-sm font-mono font-bold ${tier.color}`}>
                  {tier.label}
                </h2>
                <span className="text-[10px] font-mono text-muted-foreground">
                  {tierDone}/{tierTotal}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground font-mono mt-0.5">
                {tier.description}
              </p>
            </div>

            {/* Items */}
            <div className="divide-y divide-border">
              {tier.items.map(item => {
                const isDone = !!checked[item.id];
                const isExpanded = !!expandedItems[item.id];

                return (
                  <div key={item.id} className="group">
                    {/* Item header — clickable */}
                    <div className="flex items-start gap-3 px-4 py-2.5">
                      {/* Checkbox */}
                      <button
                        onClick={() => toggle(item.id)}
                        className={`mt-0.5 w-4 h-4 border shrink-0 flex items-center justify-center transition-colors ${
                          isDone
                            ? 'bg-primary border-primary text-background'
                            : 'border-border hover:border-primary/50'
                        }`}
                      >
                        {isDone && (
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </button>

                      {/* Title + expand */}
                      <button
                        onClick={() => toggleExpand(item.id)}
                        className="flex-1 text-left"
                      >
                        <span className={`text-xs font-mono transition-colors ${
                          isDone ? 'text-muted-foreground line-through' : 'text-foreground'
                        }`}>
                          {item.title}
                        </span>
                      </button>

                      {/* Expand arrow */}
                      <button
                        onClick={() => toggleExpand(item.id)}
                        className="mt-0.5 text-muted-foreground hover:text-primary transition-colors shrink-0"
                      >
                        <svg
                          width="12" height="12" viewBox="0 0 24 24" fill="none"
                          stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                          className={`transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
                        >
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                      </button>
                    </div>

                    {/* Steps — collapsible */}
                    {isExpanded && (
                      <div className="px-4 pb-3 pl-11">
                        <ol className="space-y-1.5">
                          {item.steps.map((step, i) => (
                            <li key={i} className="flex items-start gap-2 text-[11px] font-mono text-muted-foreground">
                              <span className="text-primary/40 shrink-0 w-4 text-right">{i + 1}.</span>
                              <span>{step}</span>
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Reset button */}
      <div className="flex justify-end">
        <button
          onClick={() => {
            if (confirm('Reset all checklist progress?')) {
              localStorage.removeItem(STORAGE_KEY);
              setChecked({});
            }
          }}
          className="text-[10px] font-mono text-muted-foreground hover:text-expense transition-colors px-2 py-1"
        >
          reset checklist
        </button>
      </div>
    </div>
  );
}
