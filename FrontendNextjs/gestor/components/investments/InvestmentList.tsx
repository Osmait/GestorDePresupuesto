import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Investment, InvestmentType } from "@/types/investment"
import { useDeleteInvestmentMutation, useGetInvestments } from "@/hooks/queries/useInvestmentsQuery"
import { Skeleton } from "@/components/ui/skeleton"
import { InvestmentCard } from "./InvestmentCard"

interface InvestmentListProps {
    type: InvestmentType
    onEdit: (_investment: Investment) => void
}

export function InvestmentList({ type, onEdit }: InvestmentListProps) {
    const { data: investments, isLoading } = useGetInvestments()
    const deleteMutation = useDeleteInvestmentMutation()

    if (isLoading) {
        return (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map((i) => (
                    <Card key={i}>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <Skeleton className="h-4 w-[100px]" />
                            <Skeleton className="h-4 w-[50px]" />
                        </CardHeader>
                        <CardContent>
                            <Skeleton className="h-8 w-[120px] mb-2" />
                            <Skeleton className="h-4 w-[80px]" />
                        </CardContent>
                    </Card>
                ))}
            </div>
        )
    }

    const filteredInvestments = investments?.filter((inv) => inv.type === type) || []

    if (filteredInvestments.length === 0) {
        return (
            <div className="text-center py-10">
                <p className="text-muted-foreground">No investments found for this category.</p>
            </div>
        )
    }

    const handleDelete = async (id: string) => {
        if (confirm("Are you sure you want to delete this investment?")) {
            await deleteMutation.mutateAsync(id)
        }
    }

    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredInvestments.map((investment) => (
                <InvestmentCard
                    key={investment.id}
                    investment={investment}
                    onEdit={onEdit}
                    onDelete={handleDelete}
                />
            ))}
        </div>
    )
}
