"use client"

import React, { useState, useEffect } from 'react';

interface TopBarProps {
  title: string;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
}

export function TopBar({ title, subtitle, action }: TopBarProps) {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <header className="sticky top-0 z-30 flex h-12 items-center justify-between border-b border-border bg-background/80 px-5 backdrop-blur-md">
      <div className="flex items-center gap-3">
        <h1 className="text-sm font-semibold text-foreground">{title}</h1>
        {subtitle && <span className="text-xs text-muted-foreground">{subtitle}</span>}
      </div>
      <div className="flex items-center gap-3">
        {!isOnline && (
          <span className="inline-flex items-center rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-semibold text-destructive">
            Offline
          </span>
        )}
        {action}
      </div>
    </header>
  );
}
