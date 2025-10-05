"use client";

import { useOffline } from "@/hooks/use-offline";
import { OfflineDialog } from "@/components/offline-dialog";
import { OfflineIndicator } from "@/components/offline-indicator";

interface OfflineProviderProps {
  children: React.ReactNode;
}

export function OfflineProvider({ children }: OfflineProviderProps) {
  const { isOffline, showOfflineDialog, dismissOfflineDialog } = useOffline();

  return (
    <>
      <OfflineIndicator isOffline={isOffline} />
      <OfflineDialog 
        isOpen={showOfflineDialog} 
        onClose={dismissOfflineDialog}
        isOffline={isOffline}
      />
      <div className={isOffline ? "pt-10" : ""}>
        {children}
      </div>
    </>
  );
}
