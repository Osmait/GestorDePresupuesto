import { Skeleton } from "@/components/ui/skeleton"
import { BudgetCardSkeleton } from "./BudgetCardSkeleton"
import { BudgetSummarySkeleton } from "./BudgetSummarySkeleton"

export function BudgetsPageSkeleton() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 dark:from-background dark:via-background dark:to-muted/20">
            <div className="container mx-auto px-4 py-8">
                {/* Header Skeleton */}
                <div className="mb-8">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                        <div className="space-y-2">
                            <Skeleton className="h-10 w-64" />
                            <Skeleton className="h-6 w-96" />
                        </div>
                        <div className="flex items-center gap-3">
                            <Skeleton className="h-10 w-40" />
                        </div>
                    </div>
                </div>

                {/* Summary Skeleton */}
                <div className="mb-8">
                    <BudgetSummarySkeleton />
                </div>

                {/* Budget Cards Grid Skeleton */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[...Array(6)].map((_, i) => (
                        <BudgetCardSkeleton key={i} />
                    ))}
                </div>
            </div>
        </div>
    )
}
