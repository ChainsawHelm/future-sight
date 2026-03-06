'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/shared/spinner';

interface PasswordCheck {
  label: string;
  test: (pw: string) => boolean;
}

const PASSWORD_CHECKS: PasswordCheck[] = [
  { label: 'At least 8 characters', test: (pw) => pw.length >= 8 },
  { label: 'One uppercase letter',   test: (pw) => /[A-Z]/.test(pw) },
  { label: 'One lowercase letter',   test: (pw) => /[a-z]/.test(pw) },
  { label: 'One number',             test: (pw) => /[0-9]/.test(pw) },
];

function OAuthButton({ label, icon, onClick, disabled }: {
  label: string; icon: React.ReactNode;
  onClick: () => void; disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex items-center justify-center gap-2 border border-border bg-surface-1 hover:border-primary/30 hover:bg-primary/[0.04] transition-all h-9 px-3 text-[10px] text-foreground/60 font-mono font-medium disabled:opacity-40 disabled:pointer-events-none w-full tracking-wider uppercase"
    >
      {icon}
      {label}
    </button>
  );
}

export function RegisterForm() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [showPasswordReqs, setShowPasswordReqs] = useState(false);

  const allChecksPassed = PASSWORD_CHECKS.every((c) => c.test(password));
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!allChecksPassed) { setFormError('Password does not meet requirements'); return; }
    if (!passwordsMatch) { setFormError('Passwords do not match'); return; }

    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (!res.ok) { setFormError(data.error || 'Registration failed'); setIsLoading(false); return; }

      const result = await signIn('credentials', { email, password, redirect: false });
      if (result?.error) { router.push('/login?registered=true'); return; }

      router.push('/dashboard');
      router.refresh();
    } catch {
      setFormError('Something went wrong. Please try again.');
      setIsLoading(false);
    }
  };

  const handleOAuth = (provider: string) => {
    setIsLoading(true);
    signIn(provider, { callbackUrl: '/dashboard' });
  };

  return (
    <div className="w-full max-w-[380px] mx-auto animate-fade-in font-mono">

      {/* Terminal brand */}
      <div className="flex flex-col items-center mb-6 text-center">
        <div className="mb-3 text-primary text-3xl font-bold animate-gold-pulse">
          {'>_'}
        </div>
        <h1 className="text-xl font-bold text-primary tracking-[0.15em] uppercase leading-none mb-1.5">
          FUTURE_SIGHT
        </h1>
        <p className="text-[9px] tracking-[0.2em] uppercase text-muted-foreground">
          // initialize new user
        </p>
      </div>

      {/* Terminal window */}
      <div className="border border-primary/20 overflow-hidden bg-card shadow-terminal">
        {/* Window header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-surface-2">
          <span className="text-[10px] text-primary/60 tracking-[0.1em] uppercase">
            [AUTH] REGISTER
          </span>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 bg-expense/60" />
            <span className="w-2 h-2 bg-neutral/60" />
            <span className="w-2 h-2 bg-income/60" />
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* System message */}
          <div className="text-[10px] text-muted-foreground">
            <span className="text-primary/50">&gt;</span> Create credentials to initialize terminal...
          </div>

          {/* Error */}
          {formError && (
            <div className="border border-expense/30 bg-expense/[0.06] px-3 py-2 text-[10px] text-expense font-mono animate-fade-in">
              ERROR: {formError}
            </div>
          )}

          {/* OAuth */}
          <div className="grid grid-cols-2 gap-2">
            <OAuthButton
              label="Google" disabled={isLoading}
              onClick={() => handleOAuth('google')}
              icon={<svg className="h-3 w-3" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>}
            />
            <OAuthButton
              label="GitHub" disabled={isLoading}
              onClick={() => handleOAuth('github')}
              icon={<svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>}
            />
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-line" />
            <span className="text-[8px] text-muted-foreground/50 tracking-widest uppercase">OR</span>
            <div className="flex-1 h-line" />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1">
              <label htmlFor="name" className="ticker text-primary/50">$ name</label>
              <Input
                id="name" type="text" placeholder="Your name"
                value={name} onChange={(e) => setName(e.target.value)}
                required autoComplete="name" disabled={isLoading}
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="email" className="ticker text-primary/50">$ email</label>
              <Input
                id="email" type="email" placeholder="user@domain.com"
                value={email} onChange={(e) => setEmail(e.target.value)}
                required autoComplete="email" disabled={isLoading}
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="password" className="ticker text-primary/50">$ password</label>
              <Input
                id="password" type="password" placeholder="********"
                value={password} onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setShowPasswordReqs(true)}
                required autoComplete="new-password" disabled={isLoading}
              />
              {showPasswordReqs && password.length > 0 && (
                <div className="space-y-0.5 pt-1 animate-fade-in">
                  {PASSWORD_CHECKS.map((check) => {
                    const passed = check.test(password);
                    return (
                      <div key={check.label} className="flex items-center gap-1.5">
                        <span className={`text-[10px] font-mono ${passed ? 'text-income' : 'text-muted-foreground/40'}`}>
                          {passed ? '[x]' : '[ ]'}
                        </span>
                        <span className={`font-mono text-[10px] ${passed ? 'text-income' : 'text-muted-foreground/50'}`}>
                          {check.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="space-y-1">
              <label htmlFor="confirm-password" className="ticker text-primary/50">$ confirm_password</label>
              <Input
                id="confirm-password" type="password" placeholder="********"
                value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                required autoComplete="new-password" disabled={isLoading}
              />
              {confirmPassword.length > 0 && (
                <p className={`font-mono text-[10px] mt-0.5 ${passwordsMatch ? 'text-income' : 'text-expense'}`}>
                  {passwordsMatch ? '[OK] Passwords match' : '[ERR] Passwords do not match'}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading || !allChecksPassed || !passwordsMatch}
              className="w-full h-9 bg-primary text-primary-foreground font-bold text-[10px] tracking-[0.12em] uppercase hover:bg-primary/85 transition-all disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center gap-2 mt-1 shadow-[0_0_12px_hsl(var(--primary)/0.2)]"
            >
              {isLoading
                ? <><Spinner size="sm" className="text-primary-foreground" /> INITIALIZING...</>
                : '> CREATE ACCOUNT'
              }
            </button>
          </form>
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground/50 mt-4 text-center font-mono tracking-wide">
        Already registered?{' '}
        <Link href="/login" className="text-primary/60 hover:text-primary transition-colors">
          ./login
        </Link>
      </p>
    </div>
  );
}
