import { BudgetCardSkeleton } from "./BudgetCardSkeleton"
import { BudgetSummarySkeleton } from "./BudgetSummarySkeleton"

export function BudgetsPageSkeleton() {
    return (
        <div className="space-y-6">
            {/* Header Skeleton Removed - Server Side Rendered */}

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
    )
}
