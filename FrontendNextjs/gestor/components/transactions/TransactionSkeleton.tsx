import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export function TransactionSkeleton() {
    return (
        <Card className="relative">
            <CardContent className="p-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4 w-full">
                        {/* Icon skeleton - Adjusted to h-11 w-11 (44px) to exact match Content (p-3 + w-5) */}
                        <Skeleton className="h-11 w-11 rounded-full" />

                        <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2">
                                <Skeleton className="h-5 w-32" />
                                <Skeleton className="h-4 w-20 rounded-full" />
                            </div>
                            <Skeleton className="h-4 w-48" />
                            <Skeleton className="h-3 w-24" />
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="text-right space-y-1">
                            {/* Amount skeleton - text-xl is 28px -> h-7 */}
                            <Skeleton className="h-7 w-24 ml-auto" />
                            {/* Currency skeleton - text-xs is 16px -> h-4 */}
                            <Skeleton className="h-4 w-8 ml-auto" />
                        </div>
                        {/* Menu button skeleton */}
                        <Skeleton className="h-8 w-8 rounded-md" />
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
