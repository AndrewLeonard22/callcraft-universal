import { useState, useCallback, useRef, useEffect } from 'react';
import { handleSupabaseError, showErrorToast } from '@/utils/errorHandling';

/**
 * Custom hook for safe async operations with automatic cleanup
 * Prevents state updates after component unmount
 */
export function useSafeAsync<T = void>() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const execute = useCallback(
    async (
      operation: () => Promise<T>,
      options?: {
        onSuccess?: (data: T) => void;
        onError?: (error: string) => void;
        showErrorToast?: boolean;
        errorContext?: string;
      }
    ): Promise<T | null> => {
      if (!isMountedRef.current) return null;

      setLoading(true);
      setError(null);

      try {
        const result = await operation();

        if (isMountedRef.current) {
          setLoading(false);
          options?.onSuccess?.(result);
        }

        return result;
      } catch (err) {
        const appError = handleSupabaseError(
          err,
          options?.errorContext || 'Operation failed'
        );

        if (isMountedRef.current) {
          setLoading(false);
          setError(appError.message);

          if (options?.showErrorToast !== false) {
            showErrorToast(appError);
          }

          options?.onError?.(appError.message);
        }

        return null;
      }
    },
    []
  );

  const reset = useCallback(() => {
    if (isMountedRef.current) {
      setLoading(false);
      setError(null);
    }
  }, []);

  return { loading, error, execute, reset };
}

/**
 * Hook for managing data fetching with automatic retry and error handling
 */
export function useFetchData<T>(
  fetchFn: () => Promise<T>,
  dependencies: React.DependencyList = []
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const fetch = useCallback(async () => {
    if (!isMountedRef.current) return;

    setLoading(true);
    setError(null);

    try {
      const result = await fetchFn();
      if (isMountedRef.current) {
        setData(result);
        setLoading(false);
      }
    } catch (err) {
      const appError = handleSupabaseError(err, 'Data fetch failed');
      if (isMountedRef.current) {
        setError(appError.message);
        setLoading(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const refetch = useCallback(() => {
    fetch();
  }, [fetch]);

  return { data, loading, error, refetch };
}
