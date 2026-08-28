"use client";

import React from "react";
import { DualDate } from "@/components/ui/DualDate";
import { Badge } from "@/components/ui/Badge";

// Helper to check if string looks like an ISO date
const isISODate = (str: string) => {
  if (!/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(str)) return false;
  const d = new Date(str);
  return !isNaN(d.getTime());
};

const formatKey = (key: string) => {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (str) => str.toUpperCase())
    .replace(/Id$/, " ID");
};

const renderValue = (val: any) => {
  if (val === null || val === undefined) return <span className="text-muted-foreground italic">empty</span>;
  if (typeof val === 'boolean') {
    return <Badge variant={val ? 'success' : 'neutral'}>{val ? 'Yes' : 'No'}</Badge>;
  }
  if (typeof val === 'string' && isISODate(val)) {
    return <DualDate date={val} includeTime inline />;
  }
  if (typeof val === 'object') {
    return <pre className="text-xs bg-muted/50 p-2 rounded-md overflow-x-auto">{JSON.stringify(val, null, 2)}</pre>;
  }
  return <span className="font-medium">{val.toString()}</span>;
};

export function AuditDetailsViewer({ details }: { details: string | null }) {
  if (!details) return <span className="text-muted-foreground">-</span>;
  
  let parsed: any;
  try {
    parsed = JSON.parse(details);
  } catch (e) {
    // If it's just a raw string that isn't JSON
    return <span>{details}</span>;
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return <span>{String(parsed)}</span>;
  }

  const keys = Object.keys(parsed);
  
  // Check if it's an old/new pair format
  const isDiffFormat = keys.every(k => {
    const val = parsed[k];
    return typeof val === 'object' && val !== null && ('old' in val || 'new' in val);
  });

  if (isDiffFormat) {
    return (
      <div className="space-y-1.5 text-sm">
        {keys.map(key => {
          const { old, new: newVal } = parsed[key];
          return (
            <div key={key} className="flex items-start gap-2">
              <span className="text-muted-foreground w-28 shrink-0">{formatKey(key)}:</span>
              <div className="flex flex-wrap items-center gap-2">
                <span className="line-through opacity-70">{renderValue(old)}</span>
                <span className="text-muted-foreground">→</span>
                <span className="text-primary">{renderValue(newVal)}</span>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // Otherwise, render as a flat list
  return (
    <div className="space-y-1 text-sm">
      {keys.map(key => (
        <div key={key} className="flex items-start gap-2">
          <span className="text-muted-foreground w-28 shrink-0">{formatKey(key)}:</span>
          <div className="flex-1">{renderValue(parsed[key])}</div>
        </div>
      ))}
    </div>
  );
}
