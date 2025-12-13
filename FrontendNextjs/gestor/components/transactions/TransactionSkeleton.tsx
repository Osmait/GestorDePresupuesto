import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export function TransactionSkeleton() {
    return (
        <Card className="hover:shadow-md transition-all duration-300 border-border/50">
            <CardContent className="p-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4 w-full">
                        {/* Icon skeleton */}
                        <Skeleton className="h-12 w-12 rounded-full" />

                        <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2">
                                {/* Name skeleton */}
                                <Skeleton className="h-4 w-32" />
                                {/* Category badge skeleton */}
                                <Skeleton className="h-5 w-20 rounded-full" />
                            </div>
                            {/* Description skeleton */}
                            <Skeleton className="h-3 w-48" />
                            {/* Date skeleton */}
                            <Skeleton className="h-3 w-24" />
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="text-right space-y-2">
                            {/* Amount skeleton */}
                            <Skeleton className="h-6 w-24 ml-auto" />
                            {/* Currency skeleton */}
                            <Skeleton className="h-3 w-8 ml-auto" />
                        </div>
                        {/* Menu button skeleton */}
                        <Skeleton className="h-8 w-8 rounded-md" />
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
