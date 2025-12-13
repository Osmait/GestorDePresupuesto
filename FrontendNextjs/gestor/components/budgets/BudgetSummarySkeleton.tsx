import { Skeleton } from "@/components/ui/skeleton"

export function BudgetSummarySkeleton() {
    return (
        <div className="border border-border/50 dark:border-border/20 rounded-lg bg-card p-6 animate-pulse">
            <div className="flex items-center gap-2 mb-6">
                <Skeleton className="h-5 w-5 rounded-full" />
                <Skeleton className="h-6 w-48" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="text-center p-4 rounded-lg bg-muted/30 dark:bg-muted/10">
                        <Skeleton className="h-6 w-6 mx-auto mb-2 rounded-full" />
                        <Skeleton className="h-4 w-24 mx-auto mb-1" />
                        <Skeleton className="h-6 w-32 mx-auto" />
                    </div>
                ))}
            </div>
        </div>
    )
}
