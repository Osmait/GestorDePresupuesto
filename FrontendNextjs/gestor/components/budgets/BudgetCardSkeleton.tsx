import { Skeleton } from "@/components/ui/skeleton"

export function BudgetCardSkeleton() {
    return (
        <div className="rounded-xl border border-border/50 dark:border-border/20 p-6 bg-card animate-pulse">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-4">
                    <Skeleton className="h-12 w-12 rounded-full" />
                    <div className="space-y-2">
                        <Skeleton className="h-5 w-32" />
                        <Skeleton className="h-4 w-24" />
                    </div>
                </div>
                <Skeleton className="h-6 w-20 rounded-full" />
            </div>

            <div className="space-y-4">
                <div className="flex justify-between items-center">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-6 w-24" />
                </div>
                <div className="flex justify-between items-center">
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-6 w-24" />
                </div>
                <div className="flex justify-between items-center">
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-6 w-24" />
                </div>

                <div className="space-y-2">
                    <div className="flex justify-between">
                        <Skeleton className="h-3 w-12" />
                        <Skeleton className="h-3 w-8" />
                    </div>
                    <Skeleton className="h-2 w-full rounded-full" />
                </div>

                <div className="flex justify-between items-center pt-2 border-t border-border/50">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-3 w-24" />
                </div>
            </div>
        </div>
    )
}
