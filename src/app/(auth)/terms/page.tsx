import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service — Future Sight',
};

export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12 font-mono text-sm text-foreground/80 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-primary tracking-tight mb-1">Terms of Service</h1>
        <p className="text-xs text-muted-foreground">Last updated: March 5, 2026</p>
      </div>

      <p>
        These Terms of Service ("Terms") govern your use of the Future Sight Finance web application
        at <strong>futuresightfinance.com</strong> (the "Service"), operated by Future Sight Finance
        ("we", "us", "our"). By creating an account or using the Service, you agree to these Terms.
      </p>

      <Section title="1. The Service">
        <p>
          Future Sight Finance is a personal finance tracking tool that helps you monitor spending,
          set budgets, track goals and debts, and analyze your financial data. The Service is
          provided "as is" and is intended for personal, informational use only.
        </p>
        <p className="mt-2 font-semibold text-foreground">
          We are not a financial advisor, bank, or licensed financial institution. Nothing in the
          Service constitutes financial, investment, tax, or legal advice. Always consult a
          qualified professional before making financial decisions.
        </p>
      </Section>

      <Section title="2. Accounts">
        <ul className="list-disc pl-5 space-y-1">
          <li>You must sign in via Google or GitHub OAuth to use the Service.</li>
          <li>You are responsible for the security of your OAuth provider account.</li>
          <li>You must be at least 13 years old to use the Service.</li>
          <li>One person per account. Do not share access or create accounts for others.</li>
          <li>We reserve the right to suspend or terminate accounts that violate these Terms.</li>
        </ul>
      </Section>

      <Section title="3. Subscriptions and Payments">
        <p>
          The Service may offer free and paid subscription tiers. If you subscribe to a paid plan:
        </p>
        <ul className="list-disc pl-5 space-y-1 mt-2">
          <li>Payments are processed by <strong>Stripe</strong>. We never see or store your credit card details.</li>
          <li>Subscriptions renew automatically at the end of each billing period unless canceled.</li>
          <li>You may cancel at any time via Settings. Cancellation takes effect at the end of the current billing period — you retain access until then.</li>
          <li>
            <strong>Refunds:</strong> We offer a full refund within the first 7 days of your initial
            subscription. After that, no refunds are provided for partial billing periods. Contact
            support@futuresightfinance.com for refund requests.
          </li>
          <li>We may change pricing with 30 days&apos; notice. Price changes apply at the next renewal, not mid-cycle.</li>
        </ul>
      </Section>

      <Section title="4. Your Data">
        <ul className="list-disc pl-5 space-y-1">
          <li>You own your financial data. We do not claim any intellectual property rights over it.</li>
          <li>You grant us a limited license to process, store, and display your data solely to provide the Service.</li>
          <li>You may export all your data at any time (Settings → Export Backup).</li>
          <li>You may delete your account and all associated data at any time (Settings → Delete Account).</li>
          <li>See our <a href="/privacy" className="text-primary hover:underline">Privacy Policy</a> for full details on data handling.</li>
        </ul>
      </Section>

      <Section title="5. Bank Connections (Plaid)">
        <p>
          If you connect a bank account via Plaid, you authorize Plaid to access your financial
          institution on your behalf and share account data with us. Plaid&apos;s use of your data is
          governed by{' '}
          <a href="https://plaid.com/legal/" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">
            Plaid&apos;s End User Privacy Policy
          </a>
          . You may disconnect any bank connection at any time.
        </p>
      </Section>

      <Section title="6. Acceptable Use">
        <p>You agree not to:</p>
        <ul className="list-disc pl-5 space-y-1 mt-2">
          <li>Use the Service for any illegal purpose</li>
          <li>Attempt to access other users&apos; accounts or data</li>
          <li>Interfere with or disrupt the Service (DDoS, automated scraping, etc.)</li>
          <li>Reverse engineer, decompile, or attempt to extract the source code</li>
          <li>Use the Service to process data for third parties commercially</li>
          <li>Upload malicious content, malware, or excessively large files</li>
        </ul>
      </Section>

      <Section title="7. Accuracy and Calculations">
        <p>
          The Service provides financial calculations (budgets, projections, debt payoff estimates,
          savings rates, etc.) based on the data you provide. These calculations are estimates and
          may contain errors. We do not guarantee the accuracy of any calculation, projection, or
          insight. You are solely responsible for verifying any figures before making financial
          decisions.
        </p>
      </Section>

      <Section title="8. Service Availability">
        <p>
          We strive for high availability but do not guarantee uninterrupted access. The Service
          may be temporarily unavailable due to maintenance, updates, or circumstances beyond our
          control. We are not liable for any losses resulting from downtime.
        </p>
      </Section>

      <Section title="9. Limitation of Liability">
        <p>
          To the maximum extent permitted by law:
        </p>
        <ul className="list-disc pl-5 space-y-1 mt-2">
          <li>
            The Service is provided <strong>"AS IS"</strong> and <strong>"AS AVAILABLE"</strong> without
            warranties of any kind, express or implied.
          </li>
          <li>
            We disclaim all warranties including merchantability, fitness for a particular purpose,
            and non-infringement.
          </li>
          <li>
            In no event shall we be liable for any indirect, incidental, special, consequential,
            or punitive damages, or any loss of profits, data, or goodwill.
          </li>
          <li>
            Our total liability for any claim arising from the Service shall not exceed the amount
            you paid us in the 12 months preceding the claim, or $50, whichever is greater.
          </li>
        </ul>
      </Section>

      <Section title="10. Indemnification">
        <p>
          You agree to indemnify and hold us harmless from any claims, damages, or expenses
          (including reasonable attorney fees) arising from your use of the Service, violation of
          these Terms, or violation of any third party&apos;s rights.
        </p>
      </Section>

      <Section title="11. Termination">
        <ul className="list-disc pl-5 space-y-1">
          <li>You may terminate your account at any time by deleting it in Settings.</li>
          <li>We may terminate or suspend your account if you violate these Terms, with or without notice.</li>
          <li>Upon termination, your data will be deleted. Export your data first if you want to keep it.</li>
          <li>Sections 7, 9, 10, and 12 survive termination.</li>
        </ul>
      </Section>

      <Section title="12. Governing Law and Disputes">
        <p>
          These Terms are governed by the laws of the United States. Any disputes shall be resolved
          through binding arbitration under the rules of the American Arbitration Association,
          conducted in English. You waive any right to participate in class action lawsuits or
          class-wide arbitration.
        </p>
      </Section>

      <Section title="13. Changes to These Terms">
        <p>
          We may update these Terms from time to time. We will notify you of material changes by
          posting the updated Terms on this page with a new "Last updated" date. Continued use of
          the Service after changes constitutes acceptance of the updated Terms. If you do not
          agree, you must stop using the Service and delete your account.
        </p>
      </Section>

      <Section title="14. Contact">
        <p>
          For questions about these Terms, contact us at:{' '}
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
