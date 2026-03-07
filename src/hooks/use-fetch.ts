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

