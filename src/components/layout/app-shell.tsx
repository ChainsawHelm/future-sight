'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { settingsApi } from '@/lib/api-client';
import { KeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';
import { cn } from '@/lib/utils';

/* ══════════════════════════════════════════
   NAV STRUCTURE
══════════════════════════════════════════ */
const NAV_GROUPS = [
  {
    id: 'overview',
    label: 'Overview',
    items: [
      { id: 'dashboard',    label: 'Dashboard',    href: '/dashboard',    icon: IconDashboard },
      { id: 'networth',     label: 'Net Worth',    href: '/networth',     icon: IconNetWorth },
    ],
  },
  {
    id: 'money',
    label: 'Money',
    items: [
      { id: 'transactions', label: 'Transactions', href: '/transactions', icon: IconTransactions },
      { id: 'import',       label: 'Import',       href: '/import',       icon: IconImport },
      { id: 'calendar',     label: 'Calendar',     href: '/calendar',     icon: IconCalendar },
    ],
  },
  {
    id: 'planning',
    label: 'Planning',
    items: [
      { id: 'goals',         label: 'Goals',        href: '/goals',         icon: IconGoals },
      { id: 'debts',         label: 'Debts',        href: '/debts',         icon: IconDebts },
      { id: 'budget',        label: 'Budget',       href: '/budget',        icon: IconBudget },
      { id: 'subscriptions', label: 'Subscriptions',href: '/subscriptions', icon: IconSubscriptions },
    ],
  },
  {
    id: 'analytics',
    label: 'Analytics',
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
   ICON COMPONENTS
══════════════════════════════════════════ */
function IconDashboard({ size = 15 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <rect x="2" y="2" width="9" height="9" rx="1.5" opacity="1"/>
    <rect x="13" y="2" width="9" height="5" rx="1.5" opacity="0.65"/>
    <rect x="13" y="9" width="9" height="11" rx="1.5" opacity="0.85"/>
    <rect x="2" y="13" width="9" height="9" rx="1.5" opacity="0.5"/>
  </svg>;
}
function IconNetWorth({ size = 15 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3,17 8,11 13,14 21,6"/>
    <polyline points="17,6 21,6 21,10"/>
  </svg>;
}
function IconTransactions({ size = 15 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
    <line x1="9" y1="6" x2="21" y2="6"/>
    <line x1="9" y1="12" x2="21" y2="12"/>
    <line x1="9" y1="18" x2="21" y2="18"/>
    <circle cx="4" cy="6"  r="1.5" fill="currentColor" stroke="none"/>
    <circle cx="4" cy="12" r="1.5" fill="currentColor" stroke="none"/>
    <circle cx="4" cy="18" r="1.5" fill="currentColor" stroke="none"/>
  </svg>;
}
function IconImport({ size = 15 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/>
    <line x1="12" y1="15" x2="12" y2="3"/>
  </svg>;
}
function IconCalendar({ size = 15 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
    <rect x="3" y="4" width="18" height="18" rx="2.5"/>
    <line x1="16" y1="2" x2="16" y2="6"/>
    <line x1="8" y1="2" x2="8" y2="6"/>
    <line x1="3" y1="10" x2="21" y2="10"/>
  </svg>;
}
function IconGoals({ size = 15 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
    <circle cx="12" cy="12" r="10"/>
    <circle cx="12" cy="12" r="5.5" strokeDasharray="2 2"/>
    <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none"/>
  </svg>;
}
function IconDebts({ size = 15 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
    <line x1="12" y1="1" x2="12" y2="23"/>
    <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
  </svg>;
}
function IconBudget({ size = 15 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
    <rect x="2" y="3" width="20" height="14" rx="2.5"/>
    <line x1="8" y1="21" x2="16" y2="21"/>
    <line x1="12" y1="17" x2="12" y2="21"/>
  </svg>;
}
function IconSubscriptions({ size = 15 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
    <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 002 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>
  </svg>;
}
function IconInsights({ size = 15 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
    <path d="M18 20V10M12 20V4M6 20v-6"/>
  </svg>;
}
function IconReports({ size = 15 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="16" y1="13" x2="8" y2="13"/>
    <line x1="16" y1="17" x2="8" y2="17"/>
  </svg>;
}
function IconHeatmap({ size = 15 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <rect x="2"  y="2"  width="4.5" height="4.5" rx="1" opacity="0.25"/>
    <rect x="8"  y="2"  width="4.5" height="4.5" rx="1" opacity="0.55"/>
    <rect x="14" y="2"  width="4.5" height="4.5" rx="1" opacity="0.85"/>
    <rect x="20" y="2"  width="2"   height="4.5" rx="1" opacity="1.0"/>
    <rect x="2"  y="8"  width="4.5" height="4.5" rx="1" opacity="0.5"/>
    <rect x="8"  y="8"  width="4.5" height="4.5" rx="1" opacity="1.0"/>
    <rect x="14" y="8"  width="4.5" height="4.5" rx="1" opacity="0.4"/>
    <rect x="2"  y="14" width="4.5" height="4.5" rx="1" opacity="1.0"/>
    <rect x="8"  y="14" width="4.5" height="4.5" rx="1" opacity="0.3"/>
    <rect x="14" y="14" width="4.5" height="4.5" rx="1" opacity="0.7"/>
  </svg>;
}
function IconCashFlow({ size = 15 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 2l20 20M17 2h5v5M7 22H2v-5"/>
    <path d="M22 2L12 12M2 22l5-5"/>
  </svg>;
}
function IconAchievements({ size = 15 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="5.5"/>
    <path d="M8.56 13.89L7 22l5-3 5 3-1.56-8.11"/>
  </svg>;
}
function IconSettings({ size = 15 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
  </svg>;
}

/* ══════════════════════════════════════════
   FENIX LOGOMARK — angular prism / rising form
══════════════════════════════════════════ */
function FenixMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <defs>
        <linearGradient id="fenix-gold-a" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#E8C87A"/>
          <stop offset="100%" stopColor="#9A6828"/>
        </linearGradient>
        <linearGradient id="fenix-gold-b" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="#C9A050"/>
          <stop offset="100%" stopColor="#F0D690"/>
        </linearGradient>
      </defs>
      {/* Outer diamond — subtle outline */}
      <path d="M14 2L26 14L14 26L2 14Z"
        stroke="url(#fenix-gold-a)" strokeWidth="1" opacity="0.35" fill="none"/>
      {/* Inner solid diamond */}
      <path d="M14 8L20 14L14 20L8 14Z" fill="url(#fenix-gold-a)"/>
      {/* Bright inner highlight */}
      <path d="M14 10L18 14L14 18L10 14Z" fill="url(#fenix-gold-b)" opacity="0.55"/>
      {/* Rising spark — top right */}
      <circle cx="22" cy="6" r="1.2" fill="#E8C87A" opacity="0.7"/>
      <line x1="20" y1="8" x2="22" y2="6" stroke="#E8C87A" strokeWidth="0.8" opacity="0.5"/>
    </svg>
  );
}

/* ══════════════════════════════════════════
   MOBILE FENIX MARK (smaller)
══════════════════════════════════════════ */
function FenixMarkSm() {
  return (
    <svg width="22" height="22" viewBox="0 0 28 28" fill="none">
      <defs>
        <linearGradient id="fenix-sm" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#E8C87A"/>
          <stop offset="100%" stopColor="#9A6828"/>
        </linearGradient>
      </defs>
      <path d="M14 2L26 14L14 26L2 14Z" stroke="url(#fenix-sm)" strokeWidth="1" opacity="0.35" fill="none"/>
      <path d="M14 8L20 14L14 20L8 14Z" fill="url(#fenix-sm)"/>
    </svg>
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
  const [darkMode, setDarkMode] = useState(true);   // FENIX is dark-first
  const [moreOpen, setMoreOpen] = useState(false);

  // Dark-first initialization
  useEffect(() => {
    document.documentElement.classList.add('dark');
    const load = async () => {
      try {
        const res = await settingsApi.get();
        // Default to dark; only switch to light if explicitly saved as false
        const isDark = res?.settings?.darkMode !== false;
        setDarkMode(isDark);
        document.documentElement.classList.toggle('dark', isDark);
      } catch { /* keep dark */ }
    };
    load();
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

      {/* ════════════════════════════════
          SIDEBAR — FENIX
      ════════════════════════════════ */}
      <aside
        className={cn(
          'hidden md:flex flex-col border-r border-border bg-surface-1 shrink-0 transition-all duration-250 relative',
          sidebarOpen ? 'w-[220px]' : 'w-[58px]',
        )}
      >
        {/* Gold vertical rail — collapsed state accent */}
        {!sidebarOpen && (
          <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-gradient-to-b from-transparent via-primary/40 to-transparent pointer-events-none" />
        )}

        {/* ── Logo ── */}
        <div className={cn(
          'flex items-center h-[54px] border-b border-border shrink-0',
          sidebarOpen ? 'px-4 gap-3' : 'justify-center px-0'
        )}>
          <div className="shrink-0">
            <FenixMark size={sidebarOpen ? 26 : 24} />
          </div>
          {sidebarOpen && (
            <div className="min-w-0">
              <div className="font-display font-bold text-[11px] tracking-[0.22em] uppercase text-foreground/90 leading-none">
                Future Sight
              </div>
              <div className="text-[8px] tracking-[0.18em] uppercase text-primary/60 font-mono leading-none mt-[3px]">
                FENIX
              </div>
            </div>
          )}
        </div>

        {/* ── Navigation ── */}
        <nav className="flex-1 overflow-y-auto py-3">
          {NAV_GROUPS.map((group, gi) => (
            <div key={group.id} className={gi > 0 ? 'mt-4' : ''}>
              {sidebarOpen && (
                <div className="flex items-center gap-2 px-4 mb-1.5">
                  <div className="w-[5px] h-[5px] rounded-full bg-primary/50 shrink-0" />
                  <span className="ticker text-[9px]">{group.label}</span>
                </div>
              )}
              {!sidebarOpen && gi > 0 && (
                <div className="h-px mx-3 bg-border mb-3" />
              )}
              <div className="px-2 space-y-px">
                {group.items.map(item => {
                  const isActive = pathname.startsWith(item.href);
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => router.push(item.href)}
                      title={!sidebarOpen ? item.label : undefined}
                      className={cn(
                        'w-full flex items-center gap-2.5 py-[7px] text-[11.5px] font-medium transition-all duration-150 relative',
                        sidebarOpen ? 'px-3 rounded-lg' : 'justify-center px-0 rounded-lg',
                        isActive
                          ? 'text-primary bg-primary/[0.07]'
                          : 'text-muted-foreground hover:text-foreground hover:bg-surface-2/70',
                      )}
                    >
                      {/* Gold left rail on active */}
                      {isActive && sidebarOpen && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-[60%] bg-primary rounded-r-full" />
                      )}
                      <span className={cn(
                        'flex items-center justify-center shrink-0 transition-all duration-150',
                        sidebarOpen ? 'w-[18px] h-[18px]' : 'w-[32px] h-[32px] rounded-lg',
                        !sidebarOpen && isActive && 'bg-primary/10',
                      )}>
                        <Icon size={sidebarOpen ? 14 : 15} />
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
        <div className="border-t border-border shrink-0 pt-2 pb-2 px-2">
          {/* Dark/Light toggle */}
          <button
            onClick={toggleDark}
            title={!sidebarOpen ? (darkMode ? 'Light mode' : 'Dark mode') : undefined}
            className={cn(
              'w-full flex items-center gap-2.5 py-[7px] text-[11.5px] text-muted-foreground hover:text-foreground hover:bg-surface-2/70 rounded-lg transition-colors',
              sidebarOpen ? 'px-3' : 'justify-center px-0',
            )}
          >
            <span className={cn('flex items-center justify-center shrink-0', sidebarOpen ? 'w-[18px] h-[18px]' : 'w-[32px] h-[32px]')}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
                {darkMode
                  ? <><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></>
                  : <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
                }
              </svg>
            </span>
            {sidebarOpen && <span>{darkMode ? 'Light mode' : 'Dark mode'}</span>}
          </button>

          {/* Settings */}
          <button
            onClick={() => router.push('/settings')}
            title={!sidebarOpen ? 'Settings' : undefined}
            className={cn(
              'w-full flex items-center gap-2.5 py-[7px] text-[11.5px] rounded-lg transition-colors',
              pathname.startsWith('/settings')
                ? 'text-primary bg-primary/[0.07]'
                : 'text-muted-foreground hover:text-foreground hover:bg-surface-2/70',
              sidebarOpen ? 'px-3' : 'justify-center px-0',
            )}
          >
            <span className={cn('flex items-center justify-center shrink-0', sidebarOpen ? 'w-[18px] h-[18px]' : 'w-[32px] h-[32px]')}>
              <IconSettings size={13} />
            </span>
            {sidebarOpen && <span>Settings</span>}
          </button>

          {/* Collapse */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className={cn(
              'w-full flex items-center gap-2.5 py-[7px] text-[11.5px] text-muted-foreground hover:text-foreground hover:bg-surface-2/70 rounded-lg transition-colors',
              sidebarOpen ? 'px-3' : 'justify-center px-0',
            )}
          >
            <span className={cn('flex items-center justify-center shrink-0', sidebarOpen ? 'w-[18px] h-[18px]' : 'w-[32px] h-[32px]')}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"
                className={cn('transition-transform duration-200', !sidebarOpen && 'rotate-180')}>
                <polyline points="15 18 9 12 15 6"/>
              </svg>
            </span>
            {sidebarOpen && <span>Collapse</span>}
          </button>

          {/* Gold divider */}
          <div className="h-line-gold my-2" />

          {/* User / Sign out */}
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            title={!sidebarOpen ? `Sign out` : undefined}
            className={cn(
              'w-full flex items-center gap-2.5 py-[7px] text-[11.5px] text-muted-foreground hover:text-expense hover:bg-expense/[0.06] rounded-lg transition-colors',
              sidebarOpen ? 'px-3' : 'justify-center px-0',
            )}
          >
            {/* Initials badge */}
            <span className={cn(
              'shrink-0 rounded-md border border-primary/25 bg-primary/[0.08]',
              'flex items-center justify-center',
              'text-[9px] font-bold font-mono text-primary/80',
              sidebarOpen ? 'w-[18px] h-[18px]' : 'w-[32px] h-[32px]',
            )}>
              {userInitials}
            </span>
            {sidebarOpen && (
              <div className="flex-1 text-left min-w-0">
                <div className="font-medium text-foreground/75 truncate text-[11px] leading-none">
                  {user.name || user.email}
                </div>
                <div className="text-[9px] text-muted-foreground/70 mt-[3px] leading-none">
                  Sign out
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
        <header className="md:hidden flex items-center justify-between h-[52px] px-4 border-b border-border bg-surface-1 shrink-0">
          <div className="flex items-center gap-2.5">
            <FenixMarkSm />
            <div>
              <div className="font-display font-bold text-[10px] tracking-[0.20em] uppercase text-foreground/85 leading-none">
                Future Sight
              </div>
              <div className="text-[7px] tracking-[0.15em] uppercase text-primary/50 font-mono leading-none mt-0.5">
                FENIX
              </div>
            </div>
          </div>
          <button
            onClick={toggleDark}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-2 transition-colors text-muted-foreground"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
              {darkMode
                ? <><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/></>
                : <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
              }
            </svg>
          </button>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto pb-20 md:pb-0 fenix-grid">
          <div className="p-4 md:p-5 lg:p-6 stagger animate-fade-in">
            {children}
          </div>
        </div>
      </main>

      {/* ════════════════════════════════
          MOBILE BOTTOM NAV
      ════════════════════════════════ */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-surface-1 border-t border-border">
        <div className="flex items-stretch h-[60px]">
          {ALL_ITEMS.filter(i => MOBILE_PRIMARY.includes(i.id)).map(item => {
            const isActive = pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => router.push(item.href)}
                className={cn(
                  'flex-1 flex flex-col items-center justify-center gap-[3px] transition-colors',
                  isActive ? 'text-primary' : 'text-muted-foreground',
                )}
              >
                <span className={cn(
                  'w-8 h-7 flex items-center justify-center rounded-lg transition-all',
                  isActive && 'bg-primary/10',
                )}>
                  <Icon size={16} />
                </span>
                <span className="text-[8px] font-semibold tracking-wider uppercase">{item.label}</span>
              </button>
            );
          })}
          <button
            onClick={() => setMoreOpen(!moreOpen)}
            className={cn('flex-1 flex flex-col items-center justify-center gap-[3px] transition-colors',
              moreOpen ? 'text-primary' : 'text-muted-foreground',
            )}
          >
            <span className={cn('w-8 h-7 flex items-center justify-center rounded-lg', moreOpen && 'bg-primary/10')}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/>
              </svg>
            </span>
            <span className="text-[8px] font-semibold tracking-wider uppercase">More</span>
          </button>
        </div>

        {/* More drawer */}
        {moreOpen && (
          <>
            <div className="fixed inset-0 bg-black/75 z-40" onClick={() => setMoreOpen(false)} />
            <div className="fixed bottom-[60px] left-0 right-0 bg-surface-1 border-t border-border z-50 max-h-[65vh] overflow-y-auto animate-slide-up">
              <div className="w-8 h-[3px] bg-primary/30 mx-auto my-3 rounded-full" />
              <div className="p-4 grid grid-cols-4 gap-2">
                {ALL_ITEMS.filter(i => !MOBILE_PRIMARY.includes(i.id)).map(item => {
                  const isActive = pathname.startsWith(item.href);
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => { router.push(item.href); setMoreOpen(false); }}
                      className={cn(
                        'flex flex-col items-center gap-2 py-3 px-1 rounded-xl transition-colors',
                        isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-surface-2',
                      )}
                    >
                      <Icon size={17} />
                      <span className="text-[9px] text-center leading-tight font-medium">{item.label}</span>
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
