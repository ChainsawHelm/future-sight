'use client';

import { useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Global keyboard shortcuts.
 * 
 * Navigation (press 'g' then a key):
 *   g d — Dashboard
 *   g t — Transactions
 *   g i — Import
 *   g o — Goals
 *   g b — Budget
 *   g s — Settings
 * 
 * Actions:
 *   / — Focus search (on transactions page)
 *   Escape — Close modals / clear search
 *   ? — Show shortcuts help (TODO)
 */
export function useKeyboardShortcuts() {
  const router = useRouter();

  const handler = useCallback((e: KeyboardEvent) => {
    // Don't trigger in input fields
    const target = e.target as HTMLElement;
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.tagName === 'SELECT' ||
      target.isContentEditable
    ) {
      // Escape should still work in inputs to blur them
      if (e.key === 'Escape') {
        target.blur();
      }
      return;
    }

    // "/" to focus search
    if (e.key === '/') {
      e.preventDefault();
      const searchInput = document.querySelector<HTMLInputElement>('input[placeholder*="Search"]');
      if (searchInput) {
        searchInput.focus();
        searchInput.select();
      }
      return;
    }

    // "g" prefix for navigation (vim-style)
    if (e.key === 'g') {
      // Wait for next key
      const navHandler = (e2: KeyboardEvent) => {
        window.removeEventListener('keydown', navHandler);
        const routes: Record<string, string> = {
          d: '/dashboard',
          t: '/transactions',
          i: '/import',
          o: '/goals',
          e: '/debts',
          n: '/networth',
          b: '/budget',
          u: '/subscriptions',
          c: '/calendar',
          s: '/settings',
          h: '/health',
          r: '/reports',
          a: '/achievements',
        };
        const route = routes[e2.key];
        if (route) {
          e2.preventDefault();
          router.push(route);
        }
      };
      window.addEventListener('keydown', navHandler);
      // Timeout: if no second key within 500ms, cancel
      setTimeout(() => window.removeEventListener('keydown', navHandler), 500);
      return;
    }
  }, [router]);

  useEffect(() => {
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handler]);
}

/**
 * Component that activates keyboard shortcuts.
 * Include once in the app shell.
 */
export function KeyboardShortcuts() {
  useKeyboardShortcuts();
  return null;
}
