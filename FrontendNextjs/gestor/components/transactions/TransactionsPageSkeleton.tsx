import { Skeleton } from "@/components/ui/skeleton"
import { TransactionSkeleton } from "@/components/transactions/TransactionSkeleton"

export function TransactionsPageSkeleton() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 dark:from-background dark:via-background dark:to-muted/20">
            <div className="container mx-auto px-4 py-8">
                <div className="mb-8 space-y-4">
                    <div className="flex justify-between items-center">
                        <div className="space-y-2">
                            <Skeleton className="h-10 w-64" />
                            <Skeleton className="h-5 w-96" />
                        </div>
                        <div className="flex gap-3">
                            <Skeleton className="h-10 w-24" />
                            <Skeleton className="h-10 w-40" />
                        </div>
                    </div>
                </div>

                <div className="mb-8">
                    <Skeleton className="h-40 w-full rounded-xl" />
                </div>

                <div className="space-y-4">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <TransactionSkeleton key={i} />
                    ))}
                </div>
            </div>
        </div>
    )
}
