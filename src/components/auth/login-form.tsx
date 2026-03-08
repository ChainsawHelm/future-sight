'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { Spinner } from '@/components/shared/spinner';
import { TERMINAL_DEMO_EVENT } from '@/components/shared/terminal-animation';

function OAuthButton({ label, icon, onClick, disabled, loading }: {
  label: string; icon: React.ReactNode;
  onClick: () => void; disabled: boolean; loading?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex items-center justify-center gap-2.5 border border-border bg-surface-1 hover:border-primary/30 hover:bg-primary/[0.04] transition-all h-11 px-4 text-[11px] text-foreground/70 font-mono font-medium disabled:opacity-40 disabled:pointer-events-none w-full tracking-wider uppercase"
    >
      {loading ? <Spinner size="sm" /> : icon}
      {label}
    </button>
  );
}

export function LoginForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';
  const error = searchParams.get('error');

  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);

  const handleOAuth = (provider: string) => {
    setLoadingProvider(provider);
    signIn(provider, { callbackUrl });
  };

  const errorMessage = error === 'OAuthAccountNotLinked'
    ? 'This email is already linked to a different sign-in method.'
    : error
      ? 'Sign-in failed. Please try again.'
      : null;

  return (
    <div className="w-full max-w-[380px] mx-auto animate-fade-in font-mono">

      {/* Terminal brand */}
      <div className="flex flex-col items-center mb-8 text-center">
        <div className="mb-3 text-primary text-3xl font-bold animate-gold-pulse">
          {'>_'}
        </div>
        <h1 className="text-xl font-bold text-primary tracking-[0.15em] uppercase leading-none mb-1.5">
          FUTURE_SIGHT
        </h1>
        <p className="text-[9px] tracking-[0.2em] uppercase text-muted-foreground">
          // financial command center
        </p>
      </div>

      {/* Terminal window */}
      <div className="border border-primary/20 overflow-hidden bg-card shadow-terminal">
        {/* Window header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-surface-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-primary/60 tracking-[0.1em] uppercase">
              [AUTH] LOGIN
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 bg-expense/60" />
            <span className="w-2 h-2 bg-neutral/60" />
            <span className="w-2 h-2 bg-income/60" />
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* System message */}
          <div className="text-[10px] text-muted-foreground">
            <span className="text-primary/50">&gt;</span> Sign in with your account to access terminal...
          </div>

          {/* Error */}
          {errorMessage && (
            <div className="border border-expense/30 bg-expense/[0.06] px-3 py-2 text-[10px] text-expense font-mono animate-fade-in">
              ERROR: {errorMessage}
            </div>
          )}

          {/* OAuth buttons */}
          <div className="space-y-2.5">
            <OAuthButton
              label="Continue with Google"
              disabled={loadingProvider !== null}
              loading={loadingProvider === 'google'}
              onClick={() => handleOAuth('google')}
              icon={<svg className="h-4 w-4" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>}
            />
            <OAuthButton
              label="Continue with GitHub"
              disabled={loadingProvider !== null}
              loading={loadingProvider === 'github'}
              onClick={() => handleOAuth('github')}
              icon={<svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>}
            />
          </div>

          {/* Info */}
          <div className="text-[9px] text-muted-foreground/40 text-center pt-1">
            New accounts are created automatically on first sign-in.
          </div>

          {/* Demo button */}
          <div className="pt-1 flex justify-center">
            <button
              type="button"
              onClick={() => window.dispatchEvent(new Event(TERMINAL_DEMO_EVENT))}
              className="text-[9px] text-primary/40 hover:text-primary/70 transition-colors font-mono tracking-wider uppercase"
            >
              [demo terminal]
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
