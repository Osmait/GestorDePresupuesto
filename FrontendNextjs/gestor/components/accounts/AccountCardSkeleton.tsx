import React from 'react';
import { Card, CardContent } from "@/components/ui/card"

export function AccountCardSkeleton() {
  return (
    <Card className="relative">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-4">
            <div className="h-14 w-14 rounded-full bg-muted animate-pulse" />
            <div className="space-y-2">
              <div className="h-5 w-32 rounded bg-muted animate-pulse" />
              <div className="h-4 w-24 rounded bg-muted animate-pulse" />
            </div>
          </div>
          <div className="flex flex-col items-end space-y-2">
            <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />
          </div>
        </div>
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            {/* text-sm is 20px -> h-5 */}
            <div className="h-5 w-24 rounded bg-muted animate-pulse" />
            {/* text-2xl is 32px line-height -> h-8 */}
            <div className="h-8 w-20 rounded bg-muted animate-pulse" />
          </div>
          <div className="flex justify-between items-center text-xs">
            {/* text-xs is 16px -> h-4 */}
            <div className="h-4 w-20 rounded bg-muted animate-pulse" />
            <div className="h-4 w-10 rounded bg-muted animate-pulse" />
          </div>
          <div className="flex justify-between items-center pt-2 border-t border-border/50">
            {/* text-xs -> h-4 */}
            <div className="h-4 w-8 rounded bg-muted animate-pulse" />
            {/* Badge ~20px -> h-5 */}
            <div className="h-5 w-12 rounded bg-muted animate-pulse" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}