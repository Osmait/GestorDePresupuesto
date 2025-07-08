import React from 'react';

export function AccountSummarySkeleton() {
  return (
    <div className="border-border/50 dark:border-border/20 rounded-lg bg-card p-6 animate-pulse">
      <div className="flex items-center gap-2 mb-6">
        <div className="h-6 w-6 rounded-full bg-muted animate-pulse" />
        <div className="h-5 w-40 rounded bg-muted animate-pulse" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[1,2,3,4].map((i) => (
          <div key={i} className="text-center p-4 rounded-lg bg-muted/30 dark:bg-muted/10">
            <div className="h-6 w-6 mx-auto mb-2 rounded-full bg-muted animate-pulse" />
            <div className="h-4 w-20 mx-auto mb-1 rounded bg-muted animate-pulse" />
            <div className="h-6 w-24 mx-auto mb-1 rounded bg-muted animate-pulse" />
            <div className="h-3 w-16 mx-auto rounded bg-muted animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
} 