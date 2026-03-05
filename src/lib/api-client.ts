/**
 * Future Sight API Client
 * Thin wrapper around fetch with typed responses, error handling, and query string building.
 */

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function request<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new ApiError(body.error || 'Request failed', res.status);
  }

  return res.json();
}

function qs(params: Record<string, any>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : '';
}

// ─── Transactions ───────────────────────────

export const transactionsApi = {
  list: (query?: Record<string, any>) =>
    request<any>(`/api/transactions${qs(query || {})}`),

  get: (id: string) =>
    request<any>(`/api/transactions/${id}`),

  create: (data: any) =>
    request<any>('/api/transactions', { method: 'POST', body: JSON.stringify(data) }),

  update: (id: string, data: any) =>
    request<any>(`/api/transactions/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  delete: (id: string) =>
    request<any>(`/api/transactions/${id}`, { method: 'DELETE' }),

  bulkCreate: (data: { transactions: any[]; importRecord?: any }) =>
    request<any>('/api/transactions/bulk', { method: 'POST', body: JSON.stringify(data) }),

  bulkUpdate: (ids: string[], update: any) =>
    request<any>('/api/transactions/bulk', { method: 'PATCH', body: JSON.stringify({ ids, update }) }),

  bulkDelete: (ids: string[]) =>
    request<any>('/api/transactions/bulk', { method: 'DELETE', body: JSON.stringify({ ids }) }),
};

// ─── Categories ─────────────────────────────

export const categoriesApi = {
  list: () => request<any>('/api/categories'),
  create: (data: any) =>
    request<any>('/api/categories', { method: 'POST', body: JSON.stringify(data) }),
};

// ─── Merchant Rules ─────────────────────────

export const merchantRulesApi = {
  list: () => request<any>('/api/merchant-rules'),
  upsert: (data: any) =>
    request<any>('/api/merchant-rules', { method: 'POST', body: JSON.stringify(data) }),
  delete: (merchant: string) =>
    request<any>('/api/merchant-rules', { method: 'DELETE', body: JSON.stringify({ merchant }) }),
};

// ─── Import ─────────────────────────────────

export const importApi = {
  list: () => request<any>('/api/import'),
  delete: (id: string) =>
    request<any>('/api/import', { method: 'DELETE', body: JSON.stringify({ id }) }),
};

// ─── Goals ──────────────────────────────────

export const goalsApi = {
  list: () => request<any>('/api/goals'),
  get: (id: string) => request<any>(`/api/goals/${id}`),
  create: (data: any) =>
    request<any>('/api/goals', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) =>
    request<any>(`/api/goals/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: string) =>
    request<any>(`/api/goals/${id}`, { method: 'DELETE' }),
  addContribution: (goalId: string, data: any) =>
    request<any>(`/api/goals/${goalId}/contributions`, { method: 'POST', body: JSON.stringify(data) }),
};

// ─── Debts ──────────────────────────────────

export const debtsApi = {
  list: () => request<any>('/api/debts'),
  create: (data: any) =>
    request<any>('/api/debts', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) =>
    request<any>(`/api/debts/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: string) =>
    request<any>(`/api/debts/${id}`, { method: 'DELETE' }),
};

// ─── Assets ─────────────────────────────────

export const assetsApi = {
  list: () => request<any>('/api/assets'),
  create: (data: any) =>
    request<any>('/api/assets', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) =>
    request<any>(`/api/assets/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: string) =>
    request<any>(`/api/assets/${id}`, { method: 'DELETE' }),
};

// ─── Net Worth ──────────────────────────────

export const networthApi = {
  list: () => request<any>('/api/networth'),
  create: (data: any) =>
    request<any>('/api/networth', { method: 'POST', body: JSON.stringify(data) }),
};

// ─── Budgets ────────────────────────────────

export const budgetsApi = {
  list: () => request<any>('/api/budgets'),
  upsert: (data: any) =>
    request<any>('/api/budgets', { method: 'POST', body: JSON.stringify(data) }),
  delete: (category: string) =>
    request<any>('/api/budgets', { method: 'DELETE', body: JSON.stringify({ category }) }),
};

// ─── Calendar ───────────────────────────────

export const calendarApi = {
  list: () => request<any>('/api/calendar'),
  create: (data: any) =>
    request<any>('/api/calendar', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) =>
    request<any>(`/api/calendar/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: string) =>
    request<any>(`/api/calendar/${id}`, { method: 'DELETE' }),
};

// ─── Subscriptions ──────────────────────────

export const subscriptionsApi = {
  list: () => request<any>('/api/subscriptions'),
  create: (data: any) =>
    request<any>('/api/subscriptions', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) =>
    request<any>(`/api/subscriptions/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: string) =>
    request<any>(`/api/subscriptions/${id}`, { method: 'DELETE' }),
};

// ─── Settings ───────────────────────────────

export const settingsApi = {
  get: () => request<any>('/api/settings'),
  update: (data: any) =>
    request<any>('/api/settings', { method: 'PATCH', body: JSON.stringify(data) }),
};

// ─── Dashboard ──────────────────────────────

export const dashboardApi = {
  get: () => request<any>('/api/dashboard'),
};

// ─── Backup ─────────────────────────────────

export const backupApi = {
  export: () => request<any>('/api/backup'),
  restore: (data: any) =>
    request<any>('/api/backup', { method: 'POST', body: JSON.stringify(data) }),
};

export const resetApi = {
  resetTransactionData: () =>
    request<any>('/api/reset', { method: 'POST' }),
};

export { ApiError };
