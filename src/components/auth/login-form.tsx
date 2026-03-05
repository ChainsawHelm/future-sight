'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/shared/spinner';

/* ── Inline FENIX mark ── */
function FenixMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <defs>
        <linearGradient id="login-gold-a" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#E8C87A"/>
          <stop offset="100%" stopColor="#9A6828"/>
        </linearGradient>
        <linearGradient id="login-gold-b" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="#C9A050"/>
          <stop offset="100%" stopColor="#F0D690"/>
        </linearGradient>
      </defs>
      <path d="M14 2L26 14L14 26L2 14Z" stroke="url(#login-gold-a)" strokeWidth="1" opacity="0.35" fill="none"/>
      <path d="M14 8L20 14L14 20L8 14Z" fill="url(#login-gold-a)"/>
      <path d="M14 10L18 14L14 18L10 14Z" fill="url(#login-gold-b)" opacity="0.55"/>
      <circle cx="22" cy="6" r="1.2" fill="#E8C87A" opacity="0.7"/>
    </svg>
  );
}

function OAuthButton({ label, icon, onClick, disabled }: {
  label: string; icon: React.ReactNode;
  onClick: () => void; disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex items-center justify-center gap-2.5 border border-border bg-surface-1 hover:border-primary/25 hover:bg-surface-2 transition-all h-10 px-4 text-xs text-foreground/70 font-medium disabled:opacity-40 disabled:pointer-events-none w-full rounded-lg font-mono tracking-wide"
    >
      {icon}
      {label}
    </button>
  );
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';
  const error = searchParams.get('error');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState(
    error === 'CredentialsSignin' ? 'Invalid email or password' : ''
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setFormError('');
    try {
      const result = await signIn('credentials', { email, password, redirect: false });
      if (result?.error) {
        setFormError('Invalid email or password');
        setIsLoading(false);
        return;
      }
      router.push(callbackUrl);
      router.refresh();
    } catch {
      setFormError('Something went wrong. Please try again.');
      setIsLoading(false);
    }
  };

  const handleOAuth = (provider: string) => {
    setIsLoading(true);
    signIn(provider, { callbackUrl });
  };

  return (
    <div className="w-full max-w-[360px] mx-auto animate-fade-in">

      {/* ── Brand mark ── */}
      <div className="flex flex-col items-center mb-10 text-center">
        <div className="mb-4 relative">
          <FenixMark size={40} />
          {/* Gold pulse ring */}
          <div className="absolute inset-[-8px] rounded-full border border-primary/15 animate-gold-pulse" />
        </div>
        <h1
          className="text-3xl text-foreground leading-none mb-1"
          style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 500 }}
        >
          Future Sight
        </h1>
        <p className="text-[9px] tracking-[0.25em] uppercase font-mono text-primary/60 mt-1">
          Your financial command center
        </p>
      </div>

      {/* ── Card ── */}
      <div
        className="border border-border rounded-2xl overflow-hidden"
        style={{
          background: 'hsl(237 38% 8%)',
          borderTopColor: 'hsl(42 55% 55% / 0.12)',
        }}
      >
        {/* Card header */}
        <div className="px-6 pt-6 pb-5 border-b border-border">
          <div className="flex items-center gap-2.5">
            <h2 className="text-sm font-semibold text-foreground/90">Welcome back</h2>
            <span className="flex-1 h-px bg-border" />
            <span className="ticker">sign in</span>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {/* Error */}
          {formError && (
            <div className="border border-expense/25 bg-expense/[0.06] px-3 py-2.5 text-[11px] text-expense font-mono rounded-lg animate-fade-in">
              ⚠ {formError}
            </div>
          )}

          {/* OAuth */}
          <div className="grid grid-cols-2 gap-2">
            <OAuthButton
              label="Google" disabled={isLoading}
              onClick={() => handleOAuth('google')}
              icon={<svg className="h-3.5 w-3.5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>}
            />
            <OAuthButton
              label="GitHub" disabled={isLoading}
              onClick={() => handleOAuth('github')}
              icon={<svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>}
            />
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-line" />
            <span className="ticker text-[8px]">or</span>
            <div className="flex-1 h-line" />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div className="space-y-1.5">
              <label htmlFor="email" className="ticker">Email address</label>
              <Input
                id="email" type="email" placeholder="you@example.com"
                value={email} onChange={(e) => setEmail(e.target.value)}
                required autoComplete="email" disabled={isLoading}
                className="rounded-lg"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="ticker">Password</label>
              <Input
                id="password" type="password" placeholder="••••••••"
                value={password} onChange={(e) => setPassword(e.target.value)}
                required autoComplete="current-password" minLength={8} disabled={isLoading}
                className="rounded-lg"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-10 bg-primary text-primary-foreground font-semibold text-[11px] tracking-[0.08em] uppercase hover:bg-primary/85 transition-all disabled:opacity-40 disabled:pointer-events-none rounded-lg flex items-center justify-center gap-2 mt-1"
              style={{ boxShadow: '0 0 20px hsl(42 55% 55% / 0.2), 0 0 60px hsl(42 55% 55% / 0.06)' }}
            >
              {isLoading
                ? <><Spinner size="sm" className="text-primary-foreground" /> Signing in…</>
                : 'Sign in →'
              }
            </button>
          </form>
        </div>
      </div>

      {/* Register link */}
      <p className="text-[10px] text-muted-foreground/60 mt-5 text-center font-mono tracking-wide">
        No account?{' '}
        <Link href="/register" className="text-primary/70 hover:text-primary transition-colors">
          Create one →
        </Link>
      </p>

      {/* Demo hint */}
      <div className="mt-3 text-center">
        <p className="text-[9px] text-muted-foreground/40 font-mono">
          Demo: demo@futuresight.app / Demo1234
        </p>
      </div>
    </div>
  );
}
