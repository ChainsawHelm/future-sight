import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy — Future Sight',
};

export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12 font-mono text-sm text-foreground/80 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-primary tracking-tight mb-1">Privacy Policy</h1>
        <p className="text-xs text-muted-foreground">Last updated: March 5, 2026</p>
      </div>

      <p>
        Future Sight Finance ("we", "us", "our") operates the web application at{' '}
        <strong>futuresightfinance.com</strong> (the "Service"). This Privacy Policy explains what
        data we collect, how we use it, and your rights regarding that data.
      </p>

      <Section title="1. Data We Collect">
        <SubSection title="Account Information">
          <p>
            When you sign in via Google or GitHub OAuth, we receive your name, email address, and
            profile image from the provider. We do not collect or store passwords — authentication
            is handled entirely by your OAuth provider.
          </p>
        </SubSection>
        <SubSection title="Financial Data You Provide">
          <p>
            You may upload bank statements (CSV or PDF) or manually enter transactions, budgets,
            goals, debts, assets, subscriptions, and calendar events. This data is stored in our
            database and associated with your account.
          </p>
        </SubSection>
        <SubSection title="Bank Connection Data (Plaid)">
          <p>
            If you connect a bank account, we use <strong>Plaid Inc.</strong> to securely access
            your financial institution. Plaid provides us with account balances, transaction
            history, and account metadata. We store an encrypted access token to maintain the
            connection. We never see or store your bank login credentials — those are handled
            entirely by Plaid. See{' '}
            <a href="https://plaid.com/legal/" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">
              Plaid&apos;s Privacy Policy
            </a>{' '}
            for details on their data practices.
          </p>
        </SubSection>
        <SubSection title="Usage Data">
          <p>
            We collect minimal server logs (IP addresses, request timestamps) for security and
            abuse prevention. We do not use third-party analytics or tracking cookies.
          </p>
        </SubSection>
      </Section>

      <Section title="2. How We Use Your Data">
        <ul className="list-disc pl-5 space-y-1">
          <li>To provide the Service — displaying your financial data, generating insights, tracking goals and budgets</li>
          <li>To detect and prevent fraud, abuse, and security threats (rate limiting, audit logging)</li>
          <li>To improve the Service based on aggregate, anonymized usage patterns</li>
        </ul>
        <p className="mt-3">
          We do <strong>not</strong> sell, rent, or share your personal or financial data with
          third parties for marketing or advertising purposes. Ever.
        </p>
      </Section>

      <Section title="3. Where Your Data Is Stored">
        <p>
          Your data is stored in a PostgreSQL database hosted by <strong>Supabase</strong> in
          AWS us-west-2 (Oregon, USA). The database is encrypted at rest and connections are
          encrypted in transit via TLS. Plaid access tokens are additionally encrypted with
          AES-256-GCM before storage.
        </p>
        <p className="mt-2">
          The application is hosted on <strong>Vercel</strong> with edge network distribution.
          Vercel processes requests but does not persistently store your financial data.
        </p>
      </Section>

      <Section title="4. Data Retention">
        <p>
          We retain your data for as long as your account is active. You may export all your data
          at any time via Settings → Export Backup. You may delete your entire account and all
          associated data at any time via Settings → Delete Account. Deletion is immediate and
          irreversible.
        </p>
      </Section>

      <Section title="5. Your Rights">
        <SubSection title="For All Users">
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Access:</strong> Export a complete copy of your data (Settings → Export Backup)</li>
            <li><strong>Deletion:</strong> Permanently delete your account and all data (Settings → Delete Account)</li>
            <li><strong>Portability:</strong> Your exported backup is a standard JSON file you can use anywhere</li>
            <li><strong>Disconnect:</strong> Remove bank connections at any time (Accounts page)</li>
          </ul>
        </SubSection>
        <SubSection title="For EU/EEA Residents (GDPR)">
          <p>
            You have the right to access, rectify, erase, restrict processing, and port your data.
            You may also object to processing. The legal basis for processing is your consent
            (by creating an account) and legitimate interest (security). To exercise these rights,
            contact us at the email below.
          </p>
        </SubSection>
        <SubSection title="For California Residents (CCPA)">
          <p>
            You have the right to know what personal information we collect, request deletion, and
            opt out of the sale of personal information. We do not sell personal information.
          </p>
        </SubSection>
      </Section>

      <Section title="6. Cookies">
        <p>
          We use a single essential session cookie for authentication (NextAuth). This cookie is
          strictly necessary for the Service to function and does not track you across websites.
          We do not use advertising or analytics cookies.
        </p>
      </Section>

      <Section title="7. Third-Party Services">
        <table className="w-full text-xs border border-border mt-2">
          <thead>
            <tr className="bg-surface-2 border-b border-border">
              <th className="text-left px-3 py-2">Service</th>
              <th className="text-left px-3 py-2">Purpose</th>
              <th className="text-left px-3 py-2">Data Shared</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border">
              <td className="px-3 py-2">Google OAuth</td>
              <td className="px-3 py-2">Authentication</td>
              <td className="px-3 py-2">Name, email, profile image</td>
            </tr>
            <tr className="border-b border-border">
              <td className="px-3 py-2">GitHub OAuth</td>
              <td className="px-3 py-2">Authentication</td>
              <td className="px-3 py-2">Name, email, profile image</td>
            </tr>
            <tr className="border-b border-border">
              <td className="px-3 py-2">Plaid</td>
              <td className="px-3 py-2">Bank account linking</td>
              <td className="px-3 py-2">Account balances, transactions (via Plaid — we never see your bank password)</td>
            </tr>
            <tr className="border-b border-border">
              <td className="px-3 py-2">Supabase</td>
              <td className="px-3 py-2">Database hosting</td>
              <td className="px-3 py-2">All stored data (encrypted at rest)</td>
            </tr>
            <tr>
              <td className="px-3 py-2">Vercel</td>
              <td className="px-3 py-2">Application hosting</td>
              <td className="px-3 py-2">HTTP requests (transient)</td>
            </tr>
          </tbody>
        </table>
      </Section>

      <Section title="8. Security">
        <p>
          We implement industry-standard security measures including: HTTPS/TLS encryption in
          transit, AES-256-GCM encryption for sensitive tokens, rate limiting on all API endpoints,
          Content Security Policy headers, account lockout protection, and audit logging of
          sensitive operations. No system is 100% secure, and we encourage responsible disclosure
          of any vulnerabilities.
        </p>
      </Section>

      <Section title="9. Children">
        <p>
          The Service is not directed to children under 13. We do not knowingly collect data from
          children under 13. If you believe a child has provided us with personal data, contact us
          and we will delete it.
        </p>
      </Section>

      <Section title="10. Changes to This Policy">
        <p>
          We may update this Privacy Policy from time to time. We will notify you of material
          changes by posting the updated policy on this page with a new "Last updated" date.
          Continued use of the Service after changes constitutes acceptance.
        </p>
      </Section>

      <Section title="11. Contact">
        <p>
          For privacy-related questions or to exercise your data rights, contact us at:{' '}
          <strong>support@futuresightfinance.com</strong>
        </p>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-base font-bold text-foreground">{title}</h2>
      {children}
    </section>
  );
}

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5 mt-2">
      <h3 className="text-sm font-semibold text-foreground/90">{title}</h3>
      {children}
    </div>
  );
}
