"use client";

import React from "react";
import { formatDualDate } from "@/lib/date-formatter";

interface DualDateProps {
  date: Date | string;
  includeTime?: boolean;
  short?: boolean;
  className?: string;
  inline?: boolean;
}

export function DualDate({ date, includeTime, short, className = "", inline = false }: DualDateProps) {
  if (!date) return null;
  const { gc, ec } = formatDualDate(date, { includeTime, short });

  if (inline) {
    return <span className={className}>{gc} ({ec})</span>;
  }

  return (
    <div className={`flex flex-col ${className}`}>
      <span>{gc}</span>
      <span className="text-xs text-muted-foreground">{ec}</span>
    </div>
  );
}
