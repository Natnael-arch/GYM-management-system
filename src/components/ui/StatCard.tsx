import React from 'react';
import Link from 'next/link';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  variant?: 'count' | 'money' | 'warning' | 'danger';
  subtext?: string;
  href?: string;
}

export function StatCard({ title, value, icon: Icon, variant = 'count', subtext, href }: StatCardProps) {
  const iconColors = {
    count: 'text-primary',
    money: 'text-success',
    warning: 'text-warning',
    danger: 'text-destructive',
  };

  const valueColors = {
    count: 'text-foreground',
    money: 'text-foreground',
    warning: 'text-warning',
    danger: 'text-destructive',
  };

  const inner = (
    <div className="flex items-center gap-3">
      <Icon className={`w-4 h-4 shrink-0 ${iconColors[variant]}`} />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground uppercase tracking-wider leading-tight">{title}</p>
        <p className={`text-xl font-bold tabular-nums leading-tight ${valueColors[variant]}`}>
          {value}
          {subtext && <span className="text-xs font-normal text-muted-foreground ml-1.5">{subtext}</span>}
        </p>
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="bg-card border border-border rounded-lg px-4 py-3 hover:bg-muted/40 transition-colors block">
        {inner}
      </Link>
    );
  }

  return (
    <div className="bg-card border border-border rounded-lg px-4 py-3">
      {inner}
    </div>
  );
}
