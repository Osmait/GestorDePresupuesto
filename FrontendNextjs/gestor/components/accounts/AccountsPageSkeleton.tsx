import { Skeleton } from "@/components/ui/skeleton"
import { AccountCardSkeleton } from "@/components/accounts/AccountCardSkeleton"
import { AccountSummarySkeleton } from "@/components/accounts/AccountSummarySkeleton"

export function AccountsPageSkeleton() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 dark:from-background dark:via-background dark:to-muted/20">
            <div className="container mx-auto px-4 py-8">
                {/* Header Skeleton Removed */}

                {/* Account Summary Skeleton */}
                <div className="mb-8">
                    <AccountSummarySkeleton />
                </div>

                {/* Tabs Skeleton */}
                <div className="space-y-6">
                    <div className="flex gap-2 mb-6">
                        <Skeleton className="h-10 w-24 rounded-full" />
                        <Skeleton className="h-10 w-24 rounded-full" />
                        <Skeleton className="h-10 w-24 rounded-full" />
                    </div>

                    {/* Account Card Grid Skeleton */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[...Array(6)].map((_, i) => (
                            <AccountCardSkeleton key={i} />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}
