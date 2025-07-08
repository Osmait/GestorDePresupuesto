import React from 'react';

export function AccountCardSkeleton() {
  return (
    <div className="rounded-lg border border-border/50 dark:border-border/20 p-6 bg-card animate-pulse">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-4">
          <div className="h-14 w-14 rounded-full bg-muted animate-pulse" />
          <div>
            <div className="h-5 w-32 mb-2 rounded bg-muted animate-pulse" />
            <div className="h-4 w-24 rounded bg-muted animate-pulse" />
          </div>
        </div>
        <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />
      </div>
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <div className="h-4 w-24 rounded bg-muted animate-pulse" />
          <div className="h-6 w-20 rounded bg-muted animate-pulse" />
        </div>
        <div className="flex justify-between items-center text-xs">
          <div className="h-3 w-20 rounded bg-muted animate-pulse" />
          <div className="h-3 w-10 rounded bg-muted animate-pulse" />
        </div>
        <div className="flex justify-between items-center pt-2 border-t border-border/50">
          <div className="h-3 w-8 rounded bg-muted animate-pulse" />
          <div className="h-4 w-12 rounded bg-muted animate-pulse" />
        </div>
      </div>
    </div>
  );
} 