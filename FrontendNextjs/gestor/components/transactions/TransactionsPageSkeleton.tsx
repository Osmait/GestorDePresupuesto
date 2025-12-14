import { Skeleton } from "@/components/ui/skeleton"
import { TransactionSkeleton } from "@/components/transactions/TransactionSkeleton"

export function TransactionsPageSkeleton() {
    return (
        <div>
            <div className="mb-8">
                <Skeleton className="h-40 w-full rounded-xl" />
            </div>

            <div className="space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                    <TransactionSkeleton key={i} />
                ))}
            </div>
        </div>
    )
}
