'use client';

import { useCallback, useMemo } from 'react';
import { useFetch } from './use-fetch';
import { dashboardApi, transactionsApi, categoriesApi, accountNicknamesApi } from '@/lib/api-client';
import type { DashboardData, Transaction, TransactionQuery, Category } from '@/types/models';

// ─── Dashboard ──────────────────────────────

export function useDashboard() {
  return useFetch<DashboardData>(
    async () => {
      const res = await dashboardApi.get();
      return res as DashboardData;
    },
    []
  );
}

// ─── Transactions ───────────────────────────

interface TransactionsResult {
  transactions: Transaction[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export function useTransactions(query: TransactionQuery) {
  const stableKey = JSON.stringify(query);

  return useFetch<TransactionsResult>(
    async () => {
      const res = await transactionsApi.list(query);
      return res as TransactionsResult;
    },
    [stableKey]
  );
}

// ─── Categories ─────────────────────────────

export function useCategories() {
  return useFetch<Category[]>(
    async () => {
      const res = await categoriesApi.list();
      return res.categories as Category[];
    },
    []
  );
}

// ─── Account Nicknames ─────────────────

export interface AccountNickname {
  id: string;
  accountName: string;
  nickname: string;
}

export function useAccountNicknames() {
  const result = useFetch<AccountNickname[]>(
    async () => {
      const res = await accountNicknamesApi.list();
      return res.nicknames as AccountNickname[];
    },
    []
  );

  const nicknameMap = useMemo(() => {
    const map: Record<string, string> = {};
    if (result.data) {
      for (const n of result.data) map[n.accountName] = n.nickname;
    }
    return map;
  }, [result.data]);

  const getDisplayName = useCallback(
    (accountName: string) => nicknameMap[accountName] || accountName,
    [nicknameMap]
  );

  const matchesSearch = useCallback(
    (accountName: string, query: string) => {
      const q = query.toLowerCase();
      const nickname = nicknameMap[accountName];
      return accountName.toLowerCase().includes(q) ||
        (nickname ? nickname.toLowerCase().includes(q) : false);
    },
    [nicknameMap]
  );

  return { ...result, nicknameMap, getDisplayName, matchesSearch };
}
