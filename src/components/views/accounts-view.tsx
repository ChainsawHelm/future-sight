'use client';

import { PlaidLinkButton } from '@/components/plaid/plaid-link-button';
import { PlaidAccounts } from '@/components/plaid/plaid-accounts';
import { useState } from 'react';

export function AccountsView() {
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = () => setRefreshKey((k) => k + 1);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Linked Accounts</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Connect your bank accounts via Plaid for automatic transaction syncing.
          </p>
        </div>
        <PlaidLinkButton onSuccess={refresh} />
      </div>

      <div className="border bg-card/50 p-4 text-xs text-muted-foreground space-y-1">
        <p className="font-medium text-foreground text-sm">How it works</p>
        <p>Plaid securely connects to your bank. Future Sight never sees your bank login credentials.</p>
        <p>Your bank data is encrypted in transit and at rest. You can unlink any account at any time.</p>
      </div>

      <PlaidAccounts key={refreshKey} onSync={refresh} />
    </div>
  );
}
