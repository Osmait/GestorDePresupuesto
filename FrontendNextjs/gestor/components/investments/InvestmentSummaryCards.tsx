'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TrendingUp, TrendingDown, DollarSign, PieChart } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

interface InvestmentMetrics {
    totalValue: number
    totalCost: number
    totalProfit: number
    roi: number
}

export function InvestmentSummaryCards({ metrics }: { metrics: InvestmentMetrics }) {
    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Value</CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(metrics.totalValue)}</div>
                    <p className="text-xs text-muted-foreground">Current portfolio value</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
                    <PieChart className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(metrics.totalCost)}</div>
                    <p className="text-xs text-muted-foreground">Initial investment</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Profit/Loss</CardTitle>
                    {metrics.totalProfit >= 0 ? (
                        <TrendingUp className="h-4 w-4 text-green-500" />
                    ) : (
                        <TrendingDown className="h-4 w-4 text-red-500" />
                    )}
                </CardHeader>
                <CardContent>
                    <div className={`text-2xl font-bold ${metrics.totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {metrics.totalProfit >= 0 ? '+' : ''}{formatCurrency(metrics.totalProfit)}
                    </div>
                    <p className="text-xs text-muted-foreground">Realized + Unrealized</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">ROI</CardTitle>
                    {metrics.roi >= 0 ? (
                        <TrendingUp className="h-4 w-4 text-green-500" />
                    ) : (
                        <TrendingDown className="h-4 w-4 text-red-500" />
                    )}
                </CardHeader>
                <CardContent>
                    <div className={`text-2xl font-bold ${metrics.roi >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {metrics.roi.toFixed(2)}%
                    </div>
                    <p className="text-xs text-muted-foreground">Return on Investment</p>
                </CardContent>
            </Card>
        </div>
    )
}
