import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  variant?: 'count' | 'money' | 'warning' | 'danger';
  subtext?: string;
}

export function StatCard({ title, value, icon: Icon, variant = 'count', subtext }: StatCardProps) {
  const iconColors = {
    count: 'bg-primary/10 text-primary',
    money: 'bg-success/10 text-success',
    warning: 'bg-warning/10 text-warning',
    danger: 'bg-destructive/10 text-destructive',
  };

  return (
    <div className="bg-card text-card-foreground rounded-2xl p-4 border border-border shadow-sm flex flex-col justify-between">
      <div className="flex items-center justify-between mb-4">
        <div className={`p-2 rounded-full ${iconColors[variant]}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div>
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{title}</h3>
        <p className="text-3xl font-bold tabular-nums mt-1">{value}</p>
        {subtext && (
          <p className="text-sm text-muted-foreground mt-1">{subtext}</p>
        )}
      </div>
    </div>
  );
}
