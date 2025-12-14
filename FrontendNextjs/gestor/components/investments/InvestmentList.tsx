import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Investment, InvestmentType } from "@/types/investment"
import { useDeleteInvestmentMutation, useGetInvestments } from "@/hooks/queries/useInvestmentsQuery"
import { Button } from "@/components/ui/button"
import { Edit, Trash2 } from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"

interface InvestmentListProps {
    type: InvestmentType
    onEdit: (investment: Investment) => void
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
            {filteredInvestments.map((investment) => {
                const totalValue = investment.quantity * investment.current_price
                const profitLoss = (investment.current_price - investment.purchase_price) * investment.quantity
                const profitLossPercentage = ((investment.current_price - investment.purchase_price) / investment.purchase_price) * 100

                return (
                    <Card key={investment.id}>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">
                                {investment.name} ({investment.symbol})
                            </CardTitle>
                            <div className="flex space-x-2">
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(investment)}>
                                    <Edit className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(investment.id)}>
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{formatCurrency(totalValue)}</div>
                            <div className="text-xs text-muted-foreground mt-1">
                                {investment.quantity} shares @ {formatCurrency(investment.current_price)}
                            </div>
                            <div className={`text-xs mt-2 font-medium ${profitLoss >= 0 ? "text-green-600" : "text-red-600"}`}>
                                {profitLoss >= 0 ? "+" : ""}{formatCurrency(profitLoss)} ({profitLossPercentage.toFixed(2)}%)
                            </div>
                        </CardContent>
                    </Card>
                )
            })}
        </div>
    )
}
