import { useState, useEffect } from 'react';

export function useOffline() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [showOfflineDialog, setShowOfflineDialog] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      setShowOfflineDialog(false);
    };

    const handleOffline = () => {
      setIsOffline(true);
      setShowOfflineDialog(true);
    };

    // Listen for online/offline events
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check initial state
    if (!navigator.onLine) {
      setShowOfflineDialog(true);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const dismissOfflineDialog = () => {
    setShowOfflineDialog(false);
  };

  return {
    isOffline,
    showOfflineDialog,
    dismissOfflineDialog,
  };
}
