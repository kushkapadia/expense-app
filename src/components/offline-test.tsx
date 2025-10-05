"use client";

import { Button } from "@/components/ui/button";
import { useOffline } from "@/hooks/use-offline";
import { Wifi, WifiOff } from "lucide-react";

export function OfflineTest() {
  const { isOffline, showOfflineDialog, dismissOfflineDialog } = useOffline();

  const simulateOffline = () => {
    // This is for testing purposes only
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: false,
    });
    window.dispatchEvent(new Event('offline'));
  };

  const simulateOnline = () => {
    // This is for testing purposes only
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: true,
    });
    window.dispatchEvent(new Event('online'));
  };

  return (
    <div className="p-4 border rounded-lg bg-muted/50">
      <h3 className="font-semibold mb-2">Offline Detection Test</h3>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          {isOffline ? (
            <>
              <WifiOff className="h-4 w-4 text-orange-500" />
              <span className="text-orange-500">Currently Offline</span>
            </>
          ) : (
            <>
              <Wifi className="h-4 w-4 text-green-500" />
              <span className="text-green-500">Currently Online</span>
            </>
          )}
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={simulateOffline}>
            Simulate Offline
          </Button>
          <Button size="sm" variant="outline" onClick={simulateOnline}>
            Simulate Online
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Use these buttons to test offline detection. The app will show warnings when offline.
        </p>
      </div>
    </div>
  );
}
