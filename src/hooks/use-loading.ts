import { useState, useCallback } from 'react';

interface LoadingState {
  [key: string]: boolean;
}

export function useLoading() {
  const [loadingStates, setLoadingStates] = useState<LoadingState>({});

  const setLoading = useCallback((key: string, isLoading: boolean) => {
    setLoadingStates(prev => ({
      ...prev,
      [key]: isLoading
    }));
  }, []);

  const isLoading = useCallback((key: string) => {
    return loadingStates[key] || false;
  }, [loadingStates]);

  const withLoading = useCallback(async <T>(
    key: string,
    asyncFn: () => Promise<T>
  ): Promise<T> => {
    if (loadingStates[key]) {
      // If already loading, don't execute again
      throw new Error('Operation already in progress');
    }

    setLoading(key, true);
    try {
      const result = await asyncFn();
      return result;
    } finally {
      setLoading(key, false);
    }
  }, [loadingStates, setLoading]);

  const clearLoading = useCallback((key: string) => {
    setLoading(key, false);
  }, [setLoading]);

  return {
    isLoading,
    setLoading,
    withLoading,
    clearLoading
  };
}
