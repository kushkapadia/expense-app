"use client";

import { WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface OfflineIndicatorProps {
  isOffline: boolean;
  className?: string;
}

export function OfflineIndicator({ isOffline, className }: OfflineIndicatorProps) {
  if (!isOffline) return null;

  return (
    <div className={cn(
      "fixed top-0 left-0 right-0 z-50 bg-orange-500 text-white py-2 px-4 text-center text-sm font-medium",
      "flex items-center justify-center gap-2",
      className
    )}>
      <WifiOff className="h-4 w-4" />
      <span>You&apos;re offline - Changes will sync when connection is restored</span>
    </div>
  );
}
