"use client"

import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Transaction } from '@/types/transaction'
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts'
import { ArrowUpCircle, ArrowDownCircle } from 'lucide-react'

interface AccountAnalyticsProps {
    transactions: Transaction[]
}

const COLORS = ['#10b981', '#ef4444'] // Green for Income, Red for Expense

export function AccountAnalytics({ transactions }: AccountAnalyticsProps) {
    const stats = useMemo(() => {
        let income = 0
        let expense = 0
        const categorySpending: Record<string, number> = {}

        transactions.forEach(t => {
            if (t.type_transation === 'income') {
                income += t.amount
            } else {
                expense += Math.abs(t.amount)
            }
        })

        return { income, expense }
    }, [transactions])

    const pieData = [
        { name: 'Ingresos', value: stats.income },
        { name: 'Gastos', value: stats.expense }
    ].filter(d => d.value > 0)

    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Ingresos Totales</CardTitle>
                    <ArrowUpCircle className="h-4 w-4 text-green-500" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-green-500">+${stats.income.toLocaleString()}</div>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Gastos Totales</CardTitle>
                    <ArrowDownCircle className="h-4 w-4 text-red-500" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-red-500">-${stats.expense.toLocaleString()}</div>
                </CardContent>
            </Card>

            <Card className="col-span-2">
                <CardHeader>
                    <CardTitle>Resumen Financiero</CardTitle>
                </CardHeader>
                <CardContent className="h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={pieData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                            <XAxis type="number" hide />
                            <YAxis dataKey="name" type="category" width={80} />
                            <Tooltip
                                formatter={(value: number) => [`$${value.toLocaleString()}`, 'Monto']}
                                cursor={{ fill: 'transparent' }}
                            />
                            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                                {pieData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.name === 'Ingresos' ? COLORS[0] : COLORS[1]} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>
        </div>
    )
}
