'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface UseFetchResult<T> {
  data: T | null;
  error: string | null;
  isLoading: boolean;
  refetch: () => Promise<void>;
}

/**
 * Generic data fetching hook.
 * Calls `fetchFn` on mount and exposes refetch for manual refresh.
 */
export function useFetch<T>(
  fetchFn: () => Promise<T>,
  deps: any[] = []
): UseFetchResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const mountedRef = useRef(true);

  const fetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await fetchFn();
      if (mountedRef.current) setData(result);
    } catch (err: any) {
      if (mountedRef.current) setError(err.message || 'Something went wrong');
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    mountedRef.current = true;
    fetch();
    return () => { mountedRef.current = false; };
  }, [fetch]);

  return { data, error, isLoading, refetch: fetch };
}

interface UseMutationResult<TData, TInput> {
  mutate: (input: TInput) => Promise<TData | null>;
  data: TData | null;
  error: string | null;
  isLoading: boolean;
  reset: () => void;
}

/**
 * Mutation hook for POST/PATCH/DELETE actions.
 */
export function useMutation<TData, TInput = any>(
  mutationFn: (input: TInput) => Promise<TData>
): UseMutationResult<TData, TInput> {
  const [data, setData] = useState<TData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const mutate = useCallback(
    async (input: TInput): Promise<TData | null> => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await mutationFn(input);
        setData(result);
        return result;
      } catch (err: any) {
        setError(err.message || 'Something went wrong');
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [mutationFn]
  );

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setIsLoading(false);
  }, []);

  return { mutate, data, error, isLoading, reset };
}

/**
 * Optimistic mutation hook.
 * Immediately applies `onOptimistic` to update local state,
 * then fires the real mutation. On failure, calls `onRollback` to revert.
 *
 * Usage:
 *   const { mutate } = useOptimisticMutation(
 *     (id) => api.delete(id),
 *     {
 *       onOptimistic: (id) => setItems(prev => prev.filter(i => i.id !== id)),
 *       onRollback: (id, prevItems) => setItems(prevItems),
 *     }
 *   );
 */
export function useOptimisticMutation<TData, TInput = any>(
  mutationFn: (input: TInput) => Promise<TData>,
  options: {
    onOptimistic: (input: TInput) => any; // returns snapshot for rollback
    onRollback: (input: TInput, snapshot: any) => void;
    onSuccess?: (data: TData, input: TInput) => void;
  }
) {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const mutate = useCallback(
    async (input: TInput): Promise<TData | null> => {
      setError(null);
      // Apply optimistic update, capture snapshot for rollback
      const snapshot = options.onOptimistic(input);

      setIsLoading(true);
      try {
        const result = await mutationFn(input);
        options.onSuccess?.(result, input);
        return result;
      } catch (err: any) {
        // Rollback on failure
        options.onRollback(input, snapshot);
        setError(err.message || 'Something went wrong');
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [mutationFn, options]
  );

  return { mutate, error, isLoading };
}
