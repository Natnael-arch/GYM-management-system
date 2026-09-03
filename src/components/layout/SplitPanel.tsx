import React from 'react';

interface SplitPanelProps {
  left: React.ReactNode;
  right: React.ReactNode;
}

export function SplitPanel({ left, right }: SplitPanelProps) {
  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
      <div className="w-1/3 min-w-[320px] max-w-[400px] border-r border-border bg-card flex flex-col h-full overflow-hidden">
        {left}
      </div>
      <div className="flex-1 bg-background flex flex-col h-full overflow-y-auto">
        {right}
      </div>
    </div>
  );
}
