import React from 'react';
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  message?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon: Icon, title, message, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center bg-card border border-border rounded-2xl shadow-sm">
      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
        <Icon className="w-6 h-6 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-bold">{title}</h3>
      {message && <p className="text-muted-foreground mt-1 max-w-sm">{message}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
