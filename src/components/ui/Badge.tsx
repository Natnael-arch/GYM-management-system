import React from 'react';

export type BadgeVariant = 'success' | 'warning' | 'danger' | 'neutral' | 'action-insert' | 'action-update' | 'action-delete';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

export function Badge({ children, variant = 'neutral', className = '' }: BadgeProps) {
  const variants: Record<BadgeVariant, string> = {
    success: 'bg-success/15 text-success',
    warning: 'bg-warning/15 text-warning',
    danger: 'bg-destructive/15 text-destructive',
    neutral: 'bg-muted text-muted-foreground',
    'action-insert': 'bg-success/15 text-success',
    'action-update': 'bg-primary/15 text-primary',
    'action-delete': 'bg-destructive/15 text-destructive',
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${variants[variant]} ${className}`}>
      {children}
    </span>
  );
}
