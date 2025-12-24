'use client'

import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ResponsivePie } from '@nivo/pie'
import { useGetInvestments } from '@/hooks/queries/useInvestmentsQuery'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatCurrency } from '@/lib/utils'
import { InvestmentSummaryCards } from './InvestmentSummaryCards'
import { Skeleton } from '@/components/ui/skeleton'
import { useTheme } from 'next-themes'

export function InvestmentDashboard() {
    const { data: investments, isLoading } = useGetInvestments()
    const { theme } = useTheme()

    const metrics = useMemo(() => {
        if (!investments) return { totalValue: 0, totalCost: 0, totalProfit: 0, roi: 0, allocation: [], history: [] }

        let totalValue = 0
        let totalCost = 0
        const allocationMap = new Map<string, number>()

        investments.forEach(inv => {
            const value = inv.quantity * inv.current_price
            const cost = inv.quantity * inv.purchase_price
            totalValue += value
            totalCost += cost

            const currentTypeTotal = allocationMap.get(inv.type) || 0
            allocationMap.set(inv.type, currentTypeTotal + value)
        })

        const totalProfit = totalValue - totalCost
        const roi = totalCost > 0 ? (totalProfit / totalCost) * 100 : 0

        const allocation = Array.from(allocationMap.entries()).map(([id, value]) => ({
            id,
            label: id.charAt(0).toUpperCase() + id.slice(1).replace('_', ' '),
            value,
            color: id === 'stock' ? '#3b82f6' : id === 'crypto' ? '#f59e0b' : '#10b981'
        }))

        const history: { x: string; y: number }[] = []

        // Sort investments by date
        const sortedInvestments = [...investments].sort((a, b) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        )

        let runningTotal = 0
        sortedInvestments.forEach(inv => {
            const cost = inv.quantity * inv.purchase_price
            runningTotal += cost

            // Format date as YYYY-MM-DD for grouping/display
            const date = new Date(inv.created_at).toISOString().split('T')[0]

            // If multiple investments on same day, update last entry, else push new
            const lastEntry = history[history.length - 1]
            if (lastEntry && lastEntry.x === date) {
                lastEntry.y = runningTotal
            } else {
                history.push({ x: date, y: runningTotal })
            }
        })

        // Add today's point if needed, or ensuring at least 2 points for a line
        if (history.length === 1) {
            const today = new Date().toISOString().split('T')[0]
            if (history[0].x !== today) {
                history.push({ x: today, y: runningTotal })
            }
        }

        return { totalValue, totalCost, totalProfit, roi, allocation, history }
    }, [investments])

    const nivoTheme = useMemo(() => ({
        background: 'transparent',
        text: { fill: theme === 'dark' ? '#ffffff' : '#333333', fontSize: 11 },
        tooltip: {
            container: {
                background: theme === 'dark' ? '#1f2937' : '#ffffff',
                color: theme === 'dark' ? '#ffffff' : '#333333',
                fontSize: 12,
                borderRadius: '6px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            },
        },
    }), [theme])

    if (isLoading) {
        return (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
                {[1, 2, 3, 4].map((i) => (
                    <Card key={i}>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <Skeleton className="h-4 w-[100px]" />
                        </CardHeader>
                        <CardContent>
                            <Skeleton className="h-8 w-[120px]" />
                        </CardContent>
                    </Card>
                ))}
            </div>
        )
    }

    return (
        <div className="space-y-4 mb-8">
            <InvestmentSummaryCards metrics={metrics} />

            <div className="grid gap-4 md:grid-cols-2">
                <Card className="col-span-1">
                    <CardHeader>
                        <CardTitle>Asset Allocation</CardTitle>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        {metrics.allocation.length > 0 ? (
                            <ResponsivePie
                                data={metrics.allocation}
                                margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
                                innerRadius={0.6}
                                padAngle={0.5}
                                cornerRadius={3}
                                activeOuterRadiusOffset={8}
                                colors={{ datum: 'data.color' }}
                                borderWidth={1}
                                borderColor={{ from: 'color', modifiers: [['darker', 0.2]] }}
                                enableArcLinkLabels={true}
                                arcLinkLabelsSkipAngle={10}
                                arcLinkLabelsTextColor={theme === 'dark' ? '#ffffff' : '#333333'}
                                arcLinkLabelsThickness={2}
                                arcLinkLabelsColor={{ from: 'color' }}
                                arcLabelsSkipAngle={10}
                                arcLabelsTextColor={{ from: 'color', modifiers: [['darker', 2]] }}
                                theme={nivoTheme}
                                tooltip={({ datum }) => (
                                    <div style={{ color: datum.color, background: theme === 'dark' ? '#333' : '#fff', padding: '5px 10px', borderRadius: '4px' }}>
                                        <strong>{datum.label}</strong>: {formatCurrency(datum.value)} ({((datum.value / metrics.totalValue) * 100).toFixed(1)}%)
                                    </div>
                                )}
                            />
                        ) : (
                            <div className="h-full flex items-center justify-center text-muted-foreground">
                                No data to display
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card className="col-span-1">
                    <CardHeader>
                        <CardTitle>Portfolio Growth (Cost Basis)</CardTitle>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        {metrics.history.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={metrics.history} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorPortfolio" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#2563eb" stopOpacity={0.8} />
                                            <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" className="dark:stroke-gray-800" />
                                    <XAxis
                                        dataKey="x"
                                        tickLine={false}
                                        axisLine={false}
                                        tick={{ fontSize: 12, fill: '#6b7280' }}
                                        minTickGap={30}
                                        tickFormatter={(value) => {
                                            const date = new Date(value);
                                            return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                                        }}
                                    />
                                    <YAxis
                                        hide
                                        domain={['auto', 'auto']}
                                    />
                                    <Tooltip
                                        contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', backgroundColor: theme === 'dark' ? '#1f2937' : '#ffffff', color: theme === 'dark' ? '#fff' : '#000' }}
                                        labelStyle={{ fontWeight: 'bold', color: theme === 'dark' ? '#fff' : '#374151' }}
                                        formatter={(value: number) => [formatCurrency(value), 'Value']}
                                        labelFormatter={(label) => new Date(label).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="y"
                                        stroke="#2563eb"
                                        strokeWidth={2}
                                        fillOpacity={1}
                                        fill="url(#colorPortfolio)"
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-muted-foreground">
                                No history data
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
