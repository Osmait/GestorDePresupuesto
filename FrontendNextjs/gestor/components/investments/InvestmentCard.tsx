'use client'

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Edit, Trash2 } from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import { Investment } from "@/types/investment"

interface InvestmentCardProps {
    investment: Investment
    onEdit: (_investment: Investment) => void
    onDelete: (_id: string) => void
}

export function InvestmentCard({ investment, onEdit, onDelete }: InvestmentCardProps) {
    const totalValue = investment.quantity * investment.current_price
    const profitLoss = (investment.current_price - investment.purchase_price) * investment.quantity
    const profitLossPercentage = ((investment.current_price - investment.purchase_price) / investment.purchase_price) * 100

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                    {investment.name} ({investment.symbol})
                </CardTitle>
                <div className="flex space-x-2">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(investment)}>
                        <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => onDelete(investment.id)}>
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
}
