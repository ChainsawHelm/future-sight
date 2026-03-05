'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { settingsApi } from '@/lib/api-client';
import { KeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';
import { cn } from '@/lib/utils';

interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: string;
}

const NAV_GROUPS = [
  {
    label: 'Overview',
    items: [
      { id: 'dashboard', label: 'Dashboard', href: '/dashboard', icon: 'M3 3h7v7H3zM14 3h7v4H14zM14 11h7v10H14zM3 14h7v7H3z' },
      { id: 'networth', label: 'Net Worth', href: '/networth', icon: 'M2 20h20M5 20V10M10 20V4M15 20V12M20 20V8' },
      { id: 'health', label: 'Health Score', href: '/health', icon: 'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z' },
    ],
  },
  {
    label: 'Transactions',
    items: [
      { id: 'transactions', label: 'Transactions', href: '/transactions', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2M9 14l2 2 4-4' },
      { id: 'import', label: 'Import', href: '/import', icon: 'M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M12 4v12m0 0l-4-4m4 4l4-4' },
      { id: 'calendar', label: 'Calendar', href: '/calendar', icon: 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z' },
    ],
  },
  {
    label: 'Planning',
    items: [
      { id: 'goals', label: 'Goals', href: '/goals', icon: 'M13 2L3 14h9l-1 8 10-12h-9l1-8' },
      { id: 'debts', label: 'Debts', href: '/debts', icon: 'M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6' },
      { id: 'budget', label: 'Budget', href: '/budget', icon: 'M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9 12h6M12 9v6' },
      { id: 'subscriptions', label: 'Subscriptions', href: '/subscriptions', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
    ],
  },
  {
    label: 'Analysis',
    items: [
      { id: 'insights', label: 'Insights', href: '/insights', icon: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z' },
      { id: 'reports', label: 'Reports', href: '/reports', icon: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8' },
      { id: 'heatmap', label: 'Heatmap', href: '/heatmap', icon: 'M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z' },
      { id: 'yoy', label: 'Year-over-Year', href: '/yoy', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
      { id: 'cashflow', label: 'Cash Flow', href: '/cashflow', icon: 'M17 1l4 4-4 4M3 11V9a4 4 0 014-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 01-4 4H3' },
      { id: 'achievements', label: 'Achievements', href: '/achievements', icon: 'M5 3v4M3 5h4M6 17v4M4 19h4M13 3l2 4 4 .5-3 3 .5 4.5L13 13l-3.5 2 .5-4.5-3-3L11 7l2-4z' },
    ],
  },
];

const ALL_NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap(g => g.items);
const MOBILE_PRIMARY = ['dashboard', 'transactions', 'goals', 'budget'];

function NavIcon({ d, size = 16, className }: { d: string; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d={d} />
    </svg>
  );
}

function UserInitials({ name, email }: { name?: string | null; email?: string | null }) {
  const text = name || email || '?';
  const initials = text
    .split(/[\s@.]+/)
    .slice(0, 2)
    .map((w: string) => w[0]?.toUpperCase() || '')
    .join('');
  return (
    <div className="w-7 h-7 rounded-sm bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0">
      <span className="text-[10px] font-semibold text-primary font-mono">{initials}</span>
    </div>
  );
}

interface AppShellProps {
  user: { id: string; name?: string | null; email?: string | null; image?: string | null };
  children: React.ReactNode;
}

export function AppShell({ user, children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [darkMode, setDarkMode] = useState(true);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);

  // Apply dark class immediately and load settings
  useEffect(() => {
    document.documentElement.classList.add('dark');
    const loadSettings = async () => {
      try {
        const res = await settingsApi.get();
        const isDark = res?.settings?.darkMode !== false; // default to dark
        setDarkMode(isDark);
        document.documentElement.classList.toggle('dark', isDark);
        document.documentElement.classList.toggle('light', !isDark);
      } catch {
        // Keep dark as default
      }
    };
    loadSettings();
  }, []);

  const toggleDark = async () => {
    const newValue = !darkMode;
    setDarkMode(newValue);
    document.documentElement.classList.toggle('dark', newValue);
    document.documentElement.classList.toggle('light', !newValue);
    try { await settingsApi.update({ darkMode: newValue }); } catch {}
  };

  useEffect(() => { setMoreMenuOpen(false); }, [pathname]);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <KeyboardShortcuts />

      {/* ─── Sidebar ─── */}
      <aside className={cn(
        'hidden md:flex flex-col border-r border-border bg-card transition-all duration-200 ease-in-out shrink-0',
        sidebarOpen ? 'w-[200px]' : 'w-[52px]'
      )}>
        {/* Logo */}
        <div className={cn(
          'flex items-center h-12 border-b border-border shrink-0',
          sidebarOpen ? 'px-4 gap-2.5' : 'justify-center'
        )}>
          <div className="w-6 h-6 rounded-sm bg-primary flex items-center justify-center shrink-0">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="hsl(var(--primary-foreground))" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" />
            </svg>
          </div>
          {sidebarOpen && (
            <span className="text-xs font-bold tracking-widest uppercase text-foreground/90 truncate">
              Future Sight
            </span>
          )}
        </div>

        {/* Nav groups */}
        <nav className="flex-1 overflow-y-auto py-3 space-y-4">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              {sidebarOpen && (
                <p className="ticker-label px-4 mb-1">{group.label}</p>
              )}
              <div className="space-y-px">
                {group.items.map((item) => {
                  const isActive = pathname.startsWith(item.href);
                  return (
                    <button
                      key={item.id}
                      onClick={() => router.push(item.href)}
                      title={!sidebarOpen ? item.label : undefined}
                      className={cn(
                        'w-full flex items-center gap-2.5 text-xs font-medium transition-all duration-100',
                        sidebarOpen ? 'pl-4 pr-3 py-1.5' : 'justify-center py-2',
                        isActive
                          ? 'nav-active text-primary'
                          : 'text-muted-foreground hover:text-foreground hover:bg-accent/50 pl-[17px]'
                      )}
                    >
                      <NavIcon d={item.icon} size={14} className="shrink-0" />
                      {sidebarOpen && <span className="truncate">{item.label}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Bottom: user + controls */}
        <div className="border-t border-border py-2 shrink-0">
          {/* Dark mode toggle */}
          <button
            onClick={toggleDark}
            title={!sidebarOpen ? (darkMode ? 'Light mode' : 'Dark mode') : undefined}
            className={cn(
              'w-full flex items-center gap-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors py-1.5',
              sidebarOpen ? 'px-4' : 'justify-center'
            )}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
              {darkMode
                ? <path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                : <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />}
            </svg>
            {sidebarOpen && <span>{darkMode ? 'Light mode' : 'Dark mode'}</span>}
          </button>

          {/* Collapse toggle */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className={cn(
              'w-full flex items-center gap-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors py-1.5',
              sidebarOpen ? 'px-4' : 'justify-center'
            )}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={cn('shrink-0 transition-transform', !sidebarOpen && 'rotate-180')}>
              <path d="M11 19l-7-7 7-7M18 19l-7-7 7-7" />
            </svg>
            {sidebarOpen && <span>Collapse</span>}
          </button>

          {/* Settings */}
          <button
            onClick={() => router.push('/settings')}
            title={!sidebarOpen ? 'Settings' : undefined}
            className={cn(
              'w-full flex items-center gap-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors py-1.5',
              sidebarOpen ? 'px-4' : 'justify-center',
              pathname.startsWith('/settings') && 'text-primary'
            )}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
              <path d="M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
            </svg>
            {sidebarOpen && <span>Settings</span>}
          </button>

          {/* User / Sign out */}
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            title={!sidebarOpen ? 'Sign out' : undefined}
            className={cn(
              'w-full flex items-center gap-2.5 text-xs text-muted-foreground hover:text-expense transition-colors py-1.5 mt-1 border-t border-border',
              sidebarOpen ? 'px-4' : 'justify-center'
            )}
          >
            <UserInitials name={user.name} email={user.email} />
            {sidebarOpen && (
              <div className="flex-1 min-w-0 text-left">
                <div className="text-foreground font-medium truncate text-[11px]">{user.name || user.email}</div>
                <div className="text-[10px] text-muted-foreground">Sign out</div>
              </div>
            )}
          </button>
        </div>
      </aside>

      {/* ─── Main Content ─── */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile header */}
        <header className="md:hidden flex items-center justify-between h-12 px-4 border-b border-border bg-card shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-sm bg-primary flex items-center justify-center">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="hsl(var(--primary-foreground))" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" />
              </svg>
            </div>
            <span className="text-xs font-bold tracking-widest uppercase">Future Sight</span>
          </div>
          <button onClick={toggleDark} className="p-1.5 rounded hover:bg-accent transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              {darkMode ? <path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /> : <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />}
            </svg>
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-5 pb-20 md:pb-5">
          {children}
        </div>
      </main>

      {/* ─── Mobile Bottom Nav ─── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50">
        <div className="flex items-center justify-around h-14">
          {ALL_NAV_ITEMS.filter(i => MOBILE_PRIMARY.includes(i.id)).map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <button key={item.id} onClick={() => router.push(item.href)}
                className={cn('flex flex-col items-center gap-0.5 px-3 py-1.5 transition-colors',
                  isActive ? 'text-primary' : 'text-muted-foreground'
                )}>
                <NavIcon d={item.icon} size={18} />
                <span className="text-[9px] font-medium tracking-wide uppercase">{item.label}</span>
              </button>
            );
          })}
          <button onClick={() => setMoreMenuOpen(!moreMenuOpen)}
            className={cn('flex flex-col items-center gap-0.5 px-3 py-1.5 transition-colors',
              moreMenuOpen ? 'text-primary' : 'text-muted-foreground'
            )}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="12" r="1" />
            </svg>
            <span className="text-[9px] font-medium tracking-wide uppercase">More</span>
          </button>
        </div>

        {moreMenuOpen && (
          <>
            <div className="fixed inset-0 bg-black/60 z-40" onClick={() => setMoreMenuOpen(false)} />
            <div className="fixed bottom-14 left-0 right-0 bg-card border-t border-border rounded-t-lg shadow-2xl z-50 max-h-[60vh] overflow-y-auto animate-slide-up">
              <div className="w-8 h-0.5 bg-border rounded-full mx-auto my-3" />
              <div className="px-4 pb-4 grid grid-cols-4 gap-1">
                {ALL_NAV_ITEMS.filter(i => !MOBILE_PRIMARY.includes(i.id)).map((item) => {
                  const isActive = pathname.startsWith(item.href);
                  return (
                    <button key={item.id} onClick={() => { router.push(item.href); setMoreMenuOpen(false); }}
                      className={cn('flex flex-col items-center gap-1 p-2.5 rounded transition-colors',
                        isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent/50'
                      )}>
                      <NavIcon d={item.icon} size={16} />
                      <span className="text-[9px] font-medium text-center leading-tight">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </nav>
    </div>
  );
}
