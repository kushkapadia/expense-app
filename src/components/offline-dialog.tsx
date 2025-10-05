"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { WifiOff, Wifi } from "lucide-react";

interface OfflineDialogProps {
  isOpen: boolean;
  onClose: () => void;
  isOffline: boolean;
}

export function OfflineDialog({ isOpen, onClose, isOffline }: OfflineDialogProps) {
  if (!isOffline) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100">
              <WifiOff className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <DialogTitle className="text-left">You're Offline</DialogTitle>
              <DialogDescription className="text-left mt-1">
                No internet connection detected
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        
        <div className="space-y-3">
          <div className="text-sm text-muted-foreground">
            <p className="mb-2">You can still use the app, but:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Your changes won't sync to the cloud</li>
              <li>New data will be saved locally</li>
              <li>Everything will sync when you're back online</li>
            </ul>
          </div>
          
          <div className="flex items-center gap-2 p-3 bg-orange-50 rounded-lg border border-orange-200">
            <WifiOff className="h-4 w-4 text-orange-600" />
            <span className="text-sm text-orange-800">
              Check your internet connection and try again
            </span>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={onClose} className="w-full">
            Continue Offline
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
