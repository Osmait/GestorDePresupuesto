import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent } from "@/components/ui/card"

export function BudgetCardSkeleton() {
    return (
        <Card className="relative">
            <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-4">
                        <Skeleton className="h-12 w-12 rounded-full" />
                        <div className="space-y-2">
                            {/* text-lg (28px) */}
                            <Skeleton className="h-7 w-32" />
                            {/* text-sm (20px) */}
                            <Skeleton className="h-5 w-24" />
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {/* Badge */}
                        <Skeleton className="h-6 w-20 rounded-full hidden sm:block" />
                        {/* Menu Button (h-8) */}
                        <Skeleton className="h-8 w-8 rounded-md" />
                    </div>
                </div>

                <div className="space-y-4">
                    {/* Row 1 */}
                    <div className="flex justify-between items-center">
                        <Skeleton className="h-5 w-20" /> {/* text-sm -> h-5 */}
                        <Skeleton className="h-7 w-24" /> {/* text-lg -> h-7 */}
                    </div>
                    {/* Row 2 */}
                    <div className="flex justify-between items-center">
                        <Skeleton className="h-5 w-16" />
                        <Skeleton className="h-7 w-24" />
                    </div>
                    {/* Row 3 */}
                    <div className="flex justify-between items-center">
                        <Skeleton className="h-5 w-16" />
                        <Skeleton className="h-7 w-24" />
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
            </CardContent>
        </Card>
    )
}
