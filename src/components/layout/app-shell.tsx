'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { settingsApi } from '@/lib/api-client';
import { KeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';
import { MatrixRain } from '@/components/shared/matrix-rain';
import { cn } from '@/lib/utils';

/* ══════════════════════════════════════════
   NAV STRUCTURE
══════════════════════════════════════════ */
const NAV_GROUPS = [
  {
    id: 'overview',
    label: 'SYS',
    items: [
      { id: 'dashboard',    label: 'Dashboard',    href: '/dashboard',    icon: IconDashboard },
      { id: 'networth',     label: 'Net Worth',    href: '/networth',     icon: IconNetWorth },
    ],
  },
  {
    id: 'money',
    label: 'TXN',
    items: [
      { id: 'transactions', label: 'Transactions', href: '/transactions', icon: IconTransactions },
      { id: 'import',       label: 'Import',       href: '/import',       icon: IconImport },
      { id: 'accounts',     label: 'Accounts',     href: '/accounts',     icon: IconPlaid },
      { id: 'calendar',     label: 'Calendar',     href: '/calendar',     icon: IconCalendar },
    ],
  },
  {
    id: 'planning',
    label: 'PLN',
    items: [
      { id: 'goals',         label: 'Goals',        href: '/goals',         icon: IconGoals },
      { id: 'debts',         label: 'Debts',        href: '/debts',         icon: IconDebts },
      { id: 'budget',        label: 'Budget',       href: '/budget',        icon: IconBudget },
      { id: 'subscriptions', label: 'Subscriptions',href: '/subscriptions', icon: IconSubscriptions },
    ],
  },
  {
    id: 'analytics',
    label: 'LOG',
    items: [
      { id: 'insights',      label: 'Insights',     href: '/insights',      icon: IconInsights },
      { id: 'reports',       label: 'Reports',      href: '/reports',       icon: IconReports },
      { id: 'heatmap',       label: 'Heatmap',      href: '/heatmap',       icon: IconHeatmap },
      { id: 'cashflow',      label: 'Cash Flow',    href: '/cashflow',      icon: IconCashFlow },
      { id: 'achievements',  label: 'Achievements', href: '/achievements',  icon: IconAchievements },
    ],
  },
];

const ALL_ITEMS = NAV_GROUPS.flatMap(g => g.items);
const MOBILE_PRIMARY = ['dashboard', 'transactions', 'goals', 'insights'];

/* ══════════════════════════════════════════
   ICON COMPONENTS — simplified terminal style
══════════════════════════════════════════ */
function IconDashboard({ size = 14 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <rect x="3" y="3" width="8" height="8"/><rect x="13" y="3" width="8" height="5"/><rect x="13" y="10" width="8" height="11"/><rect x="3" y="13" width="8" height="8"/>
  </svg>;
}
function IconNetWorth({ size = 14 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3,17 8,11 13,14 21,6"/><polyline points="17,6 21,6 21,10"/>
  </svg>;
}
function IconTransactions({ size = 14 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
    <line x1="3" y1="6" x2="5" y2="6"/><line x1="3" y1="12" x2="5" y2="12"/><line x1="3" y1="18" x2="5" y2="18"/>
  </svg>;
}
function IconImport({ size = 14 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
  </svg>;
}
function IconCalendar({ size = 14 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <rect x="3" y="4" width="18" height="18"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
  </svg>;
}
function IconGoals({ size = 14 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1" fill="currentColor"/>
  </svg>;
}
function IconDebts({ size = 14 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
  </svg>;
}
function IconBudget({ size = 14 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <rect x="2" y="3" width="20" height="14"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
  </svg>;
}
function IconSubscriptions({ size = 14 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 002 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>
  </svg>;
}
function IconInsights({ size = 14 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <path d="M18 20V10M12 20V4M6 20v-6"/>
  </svg>;
}
function IconReports({ size = 14 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
    <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
  </svg>;
}
function IconHeatmap({ size = 14 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <rect x="3" y="3" width="5" height="5"/><rect x="10" y="3" width="5" height="5"/><rect x="17" y="3" width="4" height="5"/>
    <rect x="3" y="10" width="5" height="5"/><rect x="10" y="10" width="5" height="5"/>
    <rect x="3" y="17" width="5" height="5"/><rect x="10" y="17" width="5" height="5"/><rect x="17" y="10" width="4" height="5"/>
  </svg>;
}
function IconCashFlow({ size = 14 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 2l20 20M17 2h5v5M7 22H2v-5"/><path d="M22 2L12 12M2 22l5-5"/>
  </svg>;
}
function IconAchievements({ size = 14 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="5.5"/><path d="M8.56 13.89L7 22l5-3 5 3-1.56-8.11"/>
  </svg>;
}
function IconPlaid({ size = 14 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="5" width="18" height="14" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="7" y1="15" x2="11" y2="15"/>
  </svg>;
}
function IconSettings({ size = 14 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
  </svg>;
}

/* ══════════════════════════════════════════
   TERMINAL LOGO
══════════════════════════════════════════ */
function TerminalMark({ size = 24 }: { size?: number }) {
  return (
    <div
      className="flex items-center justify-center text-primary font-mono font-bold"
      style={{ width: size, height: size, fontSize: size * 0.6 }}
    >
      {'>_'}
    </div>
  );
}

/* ══════════════════════════════════════════
   APP SHELL
══════════════════════════════════════════ */
interface AppShellProps {
  user: { id: string; name?: string | null; email?: string | null; image?: string | null };
  children: React.ReactNode;
}

export function AppShell({ user, children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [darkMode, setDarkMode] = useState(true);
  const [moreOpen, setMoreOpen] = useState(false);
  const [activeTheme, setActiveTheme] = useState('default');

  // Dark-first initialization + theme restore
  useEffect(() => {
    document.documentElement.classList.add('dark');
    // Restore saved terminal theme
    const savedTheme = localStorage.getItem('fs-theme');
    if (savedTheme && savedTheme !== 'default') {
      document.documentElement.dataset.theme = savedTheme;
    }
    setActiveTheme(savedTheme || 'default');
    const load = async () => {
      try {
        const res = await settingsApi.get();
        const isDark = res?.settings?.darkMode !== false;
        setDarkMode(isDark);
        document.documentElement.classList.toggle('dark', isDark);
      } catch { /* keep dark */ }
    };
    load();
  }, []);

  // Listen for theme changes (from settings page)
  useEffect(() => {
    const onStorage = () => setActiveTheme(localStorage.getItem('fs-theme') || 'default');
    window.addEventListener('storage', onStorage);
    // Also poll the attribute for same-tab changes
    const observer = new MutationObserver(() => {
      setActiveTheme(document.documentElement.dataset.theme || 'default');
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => { window.removeEventListener('storage', onStorage); observer.disconnect(); };
  }, []);

  useEffect(() => { setMoreOpen(false); }, [pathname]);

  const toggleDark = async () => {
    const next = !darkMode;
    setDarkMode(next);
    document.documentElement.classList.toggle('dark', next);
    try { await settingsApi.update({ darkMode: next }); } catch { }
  };

  const userInitials = (user.name || user.email || '?')
    .split(/[\s@.]+/).slice(0, 2).map((w: string) => w[0]?.toUpperCase()).join('');

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <KeyboardShortcuts />
      {activeTheme === 'matrix' && darkMode && <MatrixRain />}

      {/* ════════════════════════════════
          SIDEBAR — TERMINAL
      ════════════════════════════════ */}
      <aside
        className={cn(
          'hidden md:flex flex-col border-r border-border bg-surface-1 shrink-0 transition-all duration-200 relative',
          sidebarOpen ? 'w-[210px]' : 'w-[52px]',
        )}
      >
        {/* ── Logo / Terminal Header ── */}
        <div className={cn(
          'flex items-center h-[48px] border-b border-border shrink-0',
          sidebarOpen ? 'px-3 gap-2' : 'justify-center px-0'
        )}>
          <TerminalMark size={sidebarOpen ? 22 : 20} />
          {sidebarOpen && (
            <div className="min-w-0">
              <div className="font-mono font-bold text-[10px] tracking-[0.15em] uppercase text-primary leading-none">
                FUTURE_SIGHT
              </div>
              <div className="text-[8px] tracking-[0.12em] uppercase text-muted-foreground font-mono leading-none mt-[2px]">
                v1.3.0
              </div>
            </div>
          )}
        </div>

        {/* ── Navigation ── */}
        <nav className="flex-1 overflow-y-auto py-2">
          {NAV_GROUPS.map((group, gi) => (
            <div key={group.id} className={gi > 0 ? 'mt-3' : ''}>
              {sidebarOpen && (
                <div className="flex items-center gap-1.5 px-3 mb-1">
                  <span className="text-[9px] font-mono font-bold text-primary/40 tracking-[0.2em]">
                    [{group.label}]
                  </span>
                  <div className="flex-1 h-px bg-border" />
                </div>
              )}
              {!sidebarOpen && gi > 0 && (
                <div className="h-px mx-2 bg-border mb-2" />
              )}
              <div className="px-1.5 space-y-px">
                {group.items.map(item => {
                  const isActive = pathname.startsWith(item.href);
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => router.push(item.href)}
                      title={!sidebarOpen ? item.label : undefined}
                      className={cn(
                        'w-full flex items-center gap-2 py-[6px] text-[11px] font-mono transition-all duration-100 relative',
                        sidebarOpen ? 'px-2.5' : 'justify-center px-0',
                        isActive
                          ? 'text-primary bg-primary/[0.08]'
                          : 'text-muted-foreground hover:text-primary/80 hover:bg-primary/[0.03]',
                      )}
                    >
                      {/* Active indicator — green left border */}
                      {isActive && sidebarOpen && (
                        <span className="absolute left-0 top-0 bottom-0 w-[2px] bg-primary" />
                      )}
                      {/* Prompt character */}
                      {sidebarOpen && (
                        <span className={cn(
                          'text-[10px] font-mono w-[10px] shrink-0',
                          isActive ? 'text-primary' : 'text-muted-foreground/40',
                        )}>
                          {isActive ? '>' : ' '}
                        </span>
                      )}
                      <span className={cn(
                        'flex items-center justify-center shrink-0',
                        !sidebarOpen && isActive && 'text-primary',
                      )}>
                        <Icon size={sidebarOpen ? 13 : 14} />
                      </span>
                      {sidebarOpen && <span className="truncate">{item.label}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* ── Bottom Controls ── */}
        <div className="border-t border-border shrink-0 pt-1.5 pb-1.5 px-1.5">
          {/* Dark/Light toggle */}
          <button
            onClick={toggleDark}
            title={!sidebarOpen ? (darkMode ? 'Light mode' : 'Dark mode') : undefined}
            className={cn(
              'w-full flex items-center gap-2 py-[6px] text-[11px] text-muted-foreground hover:text-primary/80 hover:bg-primary/[0.03] transition-colors font-mono',
              sidebarOpen ? 'px-2.5' : 'justify-center px-0',
            )}
          >
            <span className={cn('flex items-center justify-center shrink-0', sidebarOpen ? 'w-[14px] h-[14px]' : 'w-[28px] h-[28px]')}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                {darkMode
                  ? <><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></>
                  : <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
                }
              </svg>
            </span>
            {sidebarOpen && <span>{darkMode ? 'mode:light' : 'mode:dark'}</span>}
          </button>

          {/* Settings */}
          <button
            onClick={() => router.push('/settings')}
            title={!sidebarOpen ? 'Settings' : undefined}
            className={cn(
              'w-full flex items-center gap-2 py-[6px] text-[11px] font-mono transition-colors',
              pathname.startsWith('/settings')
                ? 'text-primary bg-primary/[0.08]'
                : 'text-muted-foreground hover:text-primary/80 hover:bg-primary/[0.03]',
              sidebarOpen ? 'px-2.5' : 'justify-center px-0',
            )}
          >
            <span className={cn('flex items-center justify-center shrink-0', sidebarOpen ? 'w-[14px] h-[14px]' : 'w-[28px] h-[28px]')}>
              <IconSettings size={12} />
            </span>
            {sidebarOpen && <span>./settings</span>}
          </button>

          {/* Collapse */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className={cn(
              'w-full flex items-center gap-2 py-[6px] text-[11px] text-muted-foreground hover:text-primary/80 hover:bg-primary/[0.03] transition-colors font-mono',
              sidebarOpen ? 'px-2.5' : 'justify-center px-0',
            )}
          >
            <span className={cn('flex items-center justify-center shrink-0', sidebarOpen ? 'w-[14px] h-[14px]' : 'w-[28px] h-[28px]')}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
                className={cn('transition-transform duration-200', !sidebarOpen && 'rotate-180')}>
                <polyline points="15 18 9 12 15 6"/>
              </svg>
            </span>
            {sidebarOpen && <span>{sidebarOpen ? 'collapse' : 'expand'}</span>}
          </button>

          {/* Divider */}
          <div className="h-line my-1.5" />

          {/* User / Sign out */}
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            title={!sidebarOpen ? `Sign out` : undefined}
            className={cn(
              'w-full flex items-center gap-2 py-[6px] text-[11px] text-muted-foreground hover:text-expense transition-colors font-mono',
              sidebarOpen ? 'px-2.5' : 'justify-center px-0',
            )}
          >
            {/* User badge */}
            <span className={cn(
              'shrink-0 border border-primary/20 bg-primary/[0.06]',
              'flex items-center justify-center',
              'text-[8px] font-bold font-mono text-primary/70',
              sidebarOpen ? 'w-[16px] h-[16px]' : 'w-[28px] h-[28px]',
            )}>
              {userInitials}
            </span>
            {sidebarOpen && (
              <div className="flex-1 text-left min-w-0">
                <div className="font-mono text-primary/60 truncate text-[10px] leading-none">
                  {user.name || user.email}
                </div>
                <div className="text-[8px] text-muted-foreground/50 mt-[2px] leading-none font-mono">
                  exit
                </div>
              </div>
            )}
          </button>
        </div>
      </aside>

      {/* ════════════════════════════════
          MAIN CONTENT
      ════════════════════════════════ */}
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Mobile top bar */}
        <header className="md:hidden flex items-center justify-between h-[44px] px-3 border-b border-border bg-surface-1 shrink-0">
          <div className="flex items-center gap-2">
            <TerminalMark size={18} />
            <div>
              <div className="font-mono font-bold text-[9px] tracking-[0.15em] uppercase text-primary leading-none">
                FUTURE_SIGHT
              </div>
            </div>
          </div>
          <button
            onClick={toggleDark}
            className="w-7 h-7 flex items-center justify-center hover:bg-primary/[0.05] transition-colors text-muted-foreground"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              {darkMode
                ? <><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/></>
                : <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
              }
            </svg>
          </button>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto pb-16 md:pb-0">
          <div className="p-3 md:p-4 lg:p-5 stagger animate-fade-in">
            {children}
          </div>
        </div>
      </main>

      {/* ════════════════════════════════
          MOBILE BOTTOM NAV
      ════════════════════════════════ */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-surface-1 border-t border-border">
        <div className="flex items-stretch h-[52px]">
          {ALL_ITEMS.filter(i => MOBILE_PRIMARY.includes(i.id)).map(item => {
            const isActive = pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => router.push(item.href)}
                className={cn(
                  'flex-1 flex flex-col items-center justify-center gap-[2px] transition-colors font-mono',
                  isActive ? 'text-primary' : 'text-muted-foreground',
                )}
              >
                <Icon size={15} />
                <span className="text-[7px] font-bold tracking-wider uppercase">{item.label}</span>
              </button>
            );
          })}
          <button
            onClick={() => setMoreOpen(!moreOpen)}
            className={cn('flex-1 flex flex-col items-center justify-center gap-[2px] transition-colors font-mono',
              moreOpen ? 'text-primary' : 'text-muted-foreground',
            )}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
            <span className="text-[7px] font-bold tracking-wider uppercase">More</span>
          </button>
        </div>

        {/* More drawer */}
        {moreOpen && (
          <>
            <div className="fixed inset-0 bg-black/80 z-40" onClick={() => setMoreOpen(false)} />
            <div className="fixed bottom-[52px] left-0 right-0 bg-surface-1 border-t border-border z-50 max-h-[60vh] overflow-y-auto animate-slide-up">
              <div className="w-8 h-[2px] bg-primary/30 mx-auto my-2" />
              <div className="p-3 grid grid-cols-4 gap-1.5">
                {ALL_ITEMS.filter(i => !MOBILE_PRIMARY.includes(i.id)).map(item => {
                  const isActive = pathname.startsWith(item.href);
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => { router.push(item.href); setMoreOpen(false); }}
                      className={cn(
                        'flex flex-col items-center gap-1.5 py-2.5 px-1 transition-colors font-mono',
                        isActive ? 'bg-primary/[0.08] text-primary' : 'text-muted-foreground hover:bg-primary/[0.03]',
                      )}
                    >
                      <Icon size={15} />
                      <span className="text-[8px] text-center leading-tight font-medium">{item.label}</span>
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
