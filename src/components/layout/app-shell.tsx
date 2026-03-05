'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { settingsApi } from '@/lib/api-client';
import { KeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';
import { cn } from '@/lib/utils';

/* ══════════════════════════════════════════
   NAV STRUCTURE — grouped sections
══════════════════════════════════════════ */
const NAV_GROUPS = [
  {
    id: 'overview',
    label: 'Overview',
    items: [
      { id: 'dashboard',    label: 'Dashboard',    href: '/dashboard',    icon: IconDashboard },
      { id: 'networth',     label: 'Net Worth',    href: '/networth',     icon: IconNetWorth },
      { id: 'health',       label: 'Health Score', href: '/health',       icon: IconHealth },
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
      { id: 'yoy',           label: 'Year vs Year', href: '/yoy',           icon: IconYoY },
      { id: 'cashflow',      label: 'Cash Flow',    href: '/cashflow',      icon: IconCashFlow },
      { id: 'achievements',  label: 'Achievements', href: '/achievements',  icon: IconAchievements },
    ],
  },
];

const ALL_ITEMS = NAV_GROUPS.flatMap(g => g.items);
const MOBILE_PRIMARY = ['dashboard', 'transactions', 'goals', 'insights'];

/* ══════════════════════════════════════════
   ICON COMPONENTS — distinct filled style
══════════════════════════════════════════ */
function IconDashboard({ size = 16 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <rect x="2" y="2" width="9" height="9" rx="1" opacity="0.9"/>
    <rect x="13" y="2" width="9" height="5" rx="1" opacity="0.9"/>
    <rect x="13" y="9" width="9" height="11" rx="1" opacity="0.9"/>
    <rect x="2" y="13" width="9" height="9" rx="1" opacity="0.9"/>
  </svg>;
}
function IconNetWorth({ size = 16 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <polyline points="3,17 8,12 13,15 21,7"/>
    <line x1="3" y1="21" x2="21" y2="21" strokeWidth="1.5"/>
  </svg>;
}
function IconHealth({ size = 16 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
  </svg>;
}
function IconTransactions({ size = 16 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="8" y1="6" x2="21" y2="6"/>
    <line x1="8" y1="12" x2="21" y2="12"/>
    <line x1="8" y1="18" x2="21" y2="18"/>
    <line x1="3" y1="6" x2="3.01" y2="6"/>
    <line x1="3" y1="12" x2="3.01" y2="12"/>
    <line x1="3" y1="18" x2="3.01" y2="18"/>
  </svg>;
}
function IconImport({ size = 16 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/>
    <line x1="12" y1="15" x2="12" y2="3"/>
  </svg>;
}
function IconCalendar({ size = 16 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
    <line x1="16" y1="2" x2="16" y2="6"/>
    <line x1="8" y1="2" x2="8" y2="6"/>
    <line x1="3" y1="10" x2="21" y2="10"/>
  </svg>;
}
function IconGoals({ size = 16 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <circle cx="12" cy="12" r="6"/>
    <circle cx="12" cy="12" r="2" fill="currentColor"/>
  </svg>;
}
function IconDebts({ size = 16 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="12" y1="1" x2="12" y2="23"/>
    <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
  </svg>;
}
function IconBudget({ size = 16 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <rect x="2" y="3" width="20" height="14" rx="2"/>
    <line x1="8" y1="21" x2="16" y2="21"/>
    <line x1="12" y1="17" x2="12" y2="21"/>
  </svg>;
}
function IconSubscriptions({ size = 16 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <circle cx="12" cy="12" r="10"/>
    <polyline points="12 6 12 12 16 14"/>
  </svg>;
}
function IconInsights({ size = 16 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M2 20h.01M7 20v-4M12 20v-8M17 20v-6M22 4l-10 8-4-4-6 4"/>
  </svg>;
}
function IconReports({ size = 16 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="16" y1="13" x2="8" y2="13"/>
    <line x1="16" y1="17" x2="8" y2="17"/>
    <polyline points="10 9 9 9 8 9"/>
  </svg>;
}
function IconHeatmap({ size = 16 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <rect x="2"  y="2"  width="5" height="5" rx="0.5" opacity="0.3"/>
    <rect x="9"  y="2"  width="5" height="5" rx="0.5" opacity="0.6"/>
    <rect x="16" y="2"  width="5" height="5" rx="0.5" opacity="1.0"/>
    <rect x="2"  y="9"  width="5" height="5" rx="0.5" opacity="0.6"/>
    <rect x="9"  y="9"  width="5" height="5" rx="0.5" opacity="1.0"/>
    <rect x="16" y="9"  width="5" height="5" rx="0.5" opacity="0.4"/>
    <rect x="2"  y="16" width="5" height="5" rx="0.5" opacity="1.0"/>
    <rect x="9"  y="16" width="5" height="5" rx="0.5" opacity="0.5"/>
    <rect x="16" y="16" width="5" height="5" rx="0.5" opacity="0.2"/>
  </svg>;
}
function IconYoY({ size = 16 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="18" y1="20" x2="18" y2="10"/>
    <line x1="12" y1="20" x2="12" y2="4"/>
    <line x1="6"  y1="20" x2="6"  y2="14"/>
  </svg>;
}
function IconCashFlow({ size = 16 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="1" x2="12" y2="23"/>
    <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
    <polyline points="16 8 20 5 16 2"/>
    <polyline points="8 19 4 22 8 25"/>
  </svg>;
}
function IconAchievements({ size = 16 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="6"/>
    <path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/>
  </svg>;
}
function IconSettings({ size = 16 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/>
  </svg>;
}
function IconSignOut({ size = 16 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
    <polyline points="16 17 21 12 16 7"/>
    <line x1="21" y1="12" x2="9" y2="12"/>
  </svg>;
}

function LogoMark() {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
      <defs>
        <radialGradient id="ballGrad" cx="38%" cy="32%" r="68%">
          <stop offset="0%" stopColor="#B8C8B1" />
          <stop offset="45%" stopColor="#8FBC8F" />
          <stop offset="100%" stopColor="#4A7A4A" />
        </radialGradient>
        <radialGradient id="glowGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#8FBC8F" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#8FBC8F" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="shimmer" cx="50%" cy="85%" r="40%">
          <stop offset="0%" stopColor="#F6F3EE" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#F6F3EE" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* Soft glow ring */}
      <circle cx="13" cy="13" r="12" fill="url(#glowGrad)" />
      {/* Main sphere */}
      <circle cx="13" cy="13" r="10" fill="url(#ballGrad)" />
      {/* Bottom shimmer */}
      <circle cx="13" cy="13" r="10" fill="url(#shimmer)" />
      {/* Main highlight */}
      <ellipse cx="10" cy="9.5" rx="3" ry="1.8" fill="white" opacity="0.50" transform="rotate(-15 10 9.5)" />
      {/* Small sparkle dot */}
      <circle cx="8.5" cy="8" r="1.1" fill="white" opacity="0.70" />
      {/* Tiny star sparkle above */}
      <path d="M19 5 L19.4 6.6 L21 7 L19.4 7.4 L19 9 L18.6 7.4 L17 7 L18.6 6.6Z" fill="#B8C8B1" opacity="0.9" />
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
  const [darkMode, setDarkMode] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  // Default light, load user preference + theme
  useEffect(() => {
    document.documentElement.classList.remove('dark');
    // Apply saved theme from localStorage
    const savedTheme = localStorage.getItem('fs-theme') || 'glasshouse';
    if (savedTheme !== 'glasshouse') {
      document.documentElement.dataset.theme = savedTheme;
    } else {
      delete document.documentElement.dataset.theme;
    }
    const load = async () => {
      try {
        const res = await settingsApi.get();
        const isDark = res?.settings?.darkMode === true;
        setDarkMode(isDark);
        document.documentElement.classList.toggle('dark', isDark);
      } catch { /* keep light */ }
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
          SIDEBAR
      ════════════════════════════════ */}
      <aside
        className={cn(
          'hidden md:flex flex-col border-r border-border bg-surface-1 shrink-0 transition-all duration-200',
          sidebarOpen ? 'w-[216px]' : 'w-[56px]',
        )}
      >
        {/* Logo */}
        <div className={cn(
          'flex items-center h-12 border-b border-border shrink-0',
          sidebarOpen ? 'px-4 gap-3' : 'justify-center'
        )}>
          <div className={cn('shrink-0 transition-colors', sidebarOpen ? 'text-primary' : 'text-muted-foreground')}>
            <LogoMark />
          </div>
          {sidebarOpen && (
            <span className="font-bold text-[11px] tracking-[0.18em] uppercase text-foreground/80 truncate">
              Future Sight
            </span>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-3 space-y-5">
          {NAV_GROUPS.map(group => (
            <div key={group.id}>
              {sidebarOpen && (
                <p className="ticker px-4 mb-2">{group.label}</p>
              )}
              <div className="px-2 space-y-0.5">
                {group.items.map(item => {
                  const isActive = pathname.startsWith(item.href);
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => router.push(item.href)}
                      title={!sidebarOpen ? item.label : undefined}
                      className={cn(
                        'w-full flex items-center gap-3 px-2 py-1.5 text-xs font-medium transition-all duration-150',
                        isActive
                          ? 'text-primary bg-primary/8 rounded'
                          : 'text-muted-foreground hover:text-foreground hover:bg-surface-2 rounded',
                        !sidebarOpen && 'justify-center'
                      )}
                    >
                      {/* Icon wrapper — colored square when active */}
                      <span className={cn(
                        'flex items-center justify-center shrink-0 transition-all duration-150',
                        sidebarOpen ? 'w-6 h-6' : 'w-8 h-8',
                        isActive
                          ? 'bg-primary text-primary-foreground rounded shadow-[0_2px_8px_hsl(var(--primary)/0.35)]'
                          : 'text-muted-foreground'
                      )}>
                        <Icon size={sidebarOpen ? 13 : 15} />
                      </span>
                      {sidebarOpen && <span className="truncate">{item.label}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Bottom controls */}
        <div className="border-t border-border shrink-0 p-2 space-y-0.5">
          {/* Dark mode */}
          <button
            onClick={toggleDark}
            title={!sidebarOpen ? 'Toggle theme' : undefined}
            className={cn(
              'w-full flex items-center gap-3 px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-surface-2 rounded transition-colors',
              !sidebarOpen && 'justify-center'
            )}
          >
            <span className="flex items-center justify-center w-6 h-6 shrink-0">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
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
              'w-full flex items-center gap-3 px-2 py-1.5 text-xs transition-colors rounded',
              pathname.startsWith('/settings')
                ? 'text-primary bg-primary/8'
                : 'text-muted-foreground hover:text-foreground hover:bg-surface-2',
              !sidebarOpen && 'justify-center'
            )}
          >
            <span className={cn(
              'flex items-center justify-center w-6 h-6 shrink-0',
              pathname.startsWith('/settings') && 'bg-primary text-primary-foreground rounded shadow-[0_2px_8px_hsl(var(--primary)/0.35)]'
            )}>
              <IconSettings size={13} />
            </span>
            {sidebarOpen && <span>Settings</span>}
          </button>

          {/* Collapse toggle */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className={cn(
              'w-full flex items-center gap-3 px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-surface-2 rounded transition-colors',
              !sidebarOpen && 'justify-center'
            )}
          >
            <span className="flex items-center justify-center w-6 h-6 shrink-0">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                className={cn('transition-transform', !sidebarOpen && 'rotate-180')}>
                <polyline points="15 18 9 12 15 6"/>
              </svg>
            </span>
            {sidebarOpen && <span>Collapse</span>}
          </button>

          {/* User / Sign out */}
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            title={!sidebarOpen ? `Sign out ${user.name || user.email}` : undefined}
            className={cn(
              'w-full flex items-center gap-3 px-2 py-2 text-xs text-muted-foreground hover:text-expense hover:bg-expense/5 rounded transition-colors mt-1 border-t border-border pt-2',
              !sidebarOpen && 'justify-center'
            )}
          >
            <span className={cn(
              'w-6 h-6 shrink-0 rounded bg-surface-3 border border-border flex items-center justify-center',
              'text-[9px] font-bold font-mono text-foreground/70'
            )}>
              {userInitials}
            </span>
            {sidebarOpen && (
              <div className="flex-1 text-left min-w-0">
                <div className="font-medium text-foreground/80 truncate text-[11px]">{user.name || user.email}</div>
                <div className="text-[10px] text-muted-foreground flex items-center gap-1 mt-px">
                  <IconSignOut size={9} />
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
        <header className="md:hidden flex items-center justify-between h-12 px-4 border-b border-border bg-surface-1 shrink-0">
          <div className="flex items-center gap-2.5 text-primary">
            <LogoMark />
            <span className="font-bold text-[10px] tracking-[0.18em] uppercase text-foreground/70">
              Future Sight
            </span>
          </div>
          <button onClick={toggleDark} className="w-8 h-8 flex items-center justify-center rounded hover:bg-surface-2 transition-colors text-muted-foreground">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              {darkMode ? <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/> : <><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/></>}
            </svg>
          </button>
        </header>

        {/* Content with dot grid */}
        <div className="flex-1 overflow-y-auto pb-20 md:pb-0 dot-grid">
          <div className="p-4 md:p-5 lg:p-6">
            {children}
          </div>
        </div>
      </main>

      {/* ════════════════════════════════
          MOBILE BOTTOM NAV
      ════════════════════════════════ */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-surface-1 border-t border-border">
        <div className="flex items-stretch h-16">
          {ALL_ITEMS.filter(i => MOBILE_PRIMARY.includes(i.id)).map(item => {
            const isActive = pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => router.push(item.href)}
                className={cn(
                  'flex-1 flex flex-col items-center justify-center gap-1 transition-colors',
                  isActive ? 'text-primary' : 'text-muted-foreground'
                )}
              >
                <span className={cn(
                  'w-8 h-8 flex items-center justify-center rounded transition-all',
                  isActive && 'bg-primary/10'
                )}>
                  <Icon size={17} />
                </span>
                <span className="text-[9px] font-semibold tracking-wider uppercase">{item.label}</span>
              </button>
            );
          })}

          <button
            onClick={() => setMoreOpen(!moreOpen)}
            className={cn('flex-1 flex flex-col items-center justify-center gap-1 transition-colors',
              moreOpen ? 'text-primary' : 'text-muted-foreground'
            )}
          >
            <span className={cn('w-8 h-8 flex items-center justify-center rounded', moreOpen && 'bg-primary/10')}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/>
              </svg>
            </span>
            <span className="text-[9px] font-semibold tracking-wider uppercase">More</span>
          </button>
        </div>

        {/* More drawer */}
        {moreOpen && (
          <>
            <div className="fixed inset-0 bg-black/70 z-40" onClick={() => setMoreOpen(false)} />
            <div className="fixed bottom-16 left-0 right-0 bg-surface-1 border-t border-border z-50 max-h-[65vh] overflow-y-auto animate-slide-up">
              <div className="w-10 h-0.5 bg-border mx-auto my-3 rounded-full" />
              <div className="p-4 grid grid-cols-4 gap-2">
                {ALL_ITEMS.filter(i => !MOBILE_PRIMARY.includes(i.id)).map(item => {
                  const isActive = pathname.startsWith(item.href);
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => { router.push(item.href); setMoreOpen(false); }}
                      className={cn(
                        'flex flex-col items-center gap-2 py-3 px-1 rounded transition-colors',
                        isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-surface-2'
                      )}
                    >
                      <Icon size={18} />
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
