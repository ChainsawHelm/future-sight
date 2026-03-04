'use client';

import { useCallback } from 'react';
import { useFetch } from './use-fetch';
import { dashboardApi, transactionsApi, categoriesApi } from '@/lib/api-client';
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
