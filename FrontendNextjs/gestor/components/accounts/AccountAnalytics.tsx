
"use client"

import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Transaction } from '@/types/transaction'
import { Category } from '@/types/category'
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, AreaChart, Area, CartesianGrid } from 'recharts'
import { ArrowUpCircle, ArrowDownCircle, TrendingUp } from 'lucide-react'
import { useTranslations, useLocale } from 'next-intl'

interface AccountAnalyticsProps {
    transactions: Transaction[]
    categories: Category[]
    currentBalance: number
}

const COLORS = ['#10b981', '#ef4444'] // Green for Income, Red for Expense

export function AccountAnalytics({ transactions, categories, currentBalance }: AccountAnalyticsProps) {
    const t = useTranslations('analytics')
    const locale = useLocale()

    const stats = useMemo(() => {
        let income = 0
        let expense = 0
        const incomeMap: Record<string, number> = {}
        const expenseMap: Record<string, number> = {}

        transactions.forEach(t => {
            const amount = Math.abs(t.amount)
            if (t.type_transation === 'income') {
                income += amount
                if (t.category_id) {
                    incomeMap[t.category_id] = (incomeMap[t.category_id] || 0) + amount
                }
            } else {
                expense += amount
                if (t.category_id) {
                    expenseMap[t.category_id] = (expenseMap[t.category_id] || 0) + amount
                }
            }
        })

        const formatCategoryData = (map: Record<string, number>, noCategory: string) => {
            return Object.entries(map).map(([id, value]) => {
                const cat = categories.find(c => c.id === id)
                return {
                    name: cat?.name || noCategory,
                    value,
                    color: cat?.color || '#94a3b8' // fallback color
                }
            }).sort((a, b) => b.value - a.value).slice(0, 5) // Top 5
        }

        // Balance History Logic
        let balanceTracker = currentBalance
        // Create a copy and sort by date descending (newest first) to walk backward
        const sortedTransactions = [...transactions].sort((a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )

        const historyPoints: { date: string; fullDate: Date; balance: number }[] = []
        // Push current state
        const dateLocale = locale === 'es' ? 'es-ES' : 'en-US'
        historyPoints.push({
            date: new Date().toLocaleDateString(dateLocale, { month: 'short', day: 'numeric' }),
            fullDate: new Date(),
            balance: balanceTracker
        })

        sortedTransactions.forEach(t => {
            // To go back in time:
            // If transaction was Income (+), we SUBTRACT it to get previous balance.
            // If transaction was Expense (-), we ADD it (using abs amount) to get previous balance.
            if (t.type_transation === 'income') {
                balanceTracker -= t.amount
            } else {
                balanceTracker += Math.abs(t.amount)
            }

            historyPoints.push({
                date: new Date(t.created_at).toLocaleDateString(dateLocale, { month: 'short', day: 'numeric' }),
                fullDate: new Date(t.created_at),
                balance: balanceTracker
            })
        })

        // Reverse to get chronological order (oldest -> newest) for Chart
        const balanceHistory = historyPoints.reverse().filter((_, index) => index % Math.ceil(historyPoints.length / 20) === 0 || index === historyPoints.length - 1) // Downsample simple logic

        // Top Expenses by Concept Logic
        const expenseByNameMap: Record<string, number> = {}
        transactions.forEach(t => {
            if (t.type_transation !== 'income') {
                expenseByNameMap[t.name] = (expenseByNameMap[t.name] || 0) + Math.abs(t.amount)
            }
        })

        const topExpenses = Object.entries(expenseByNameMap)
            .map(([name, value]) => ({ name, value, color: '#ef4444' }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 5)

        return {
            income,
            expense,
            incomeByCategory: formatCategoryData(incomeMap, t('noCategory')),
            expenseByCategory: formatCategoryData(expenseMap, t('noCategory')),
            balanceHistory,
            topExpenses
        }
    }, [transactions, categories, currentBalance, locale, t])

    const pieData = [
        { name: t('income'), value: stats.income },
        { name: t('expenses'), value: stats.expense }
    ].filter(d => d.value > 0)

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-popover border border-border p-2 rounded shadow-md text-sm">
                    <p className="font-semibold mb-1">{payload[0].name === 'balance' ? label : payload[0].payload.name}</p>
                    <p className="">${payload[0].value.toLocaleString()}</p>
                </div>
            )
        }
        return null
    }

    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">{t('totalIncome')}</CardTitle>
                    <ArrowUpCircle className="h-4 w-4 text-green-500" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-green-500">+${stats.income.toLocaleString()}</div>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">{t('totalExpenses')}</CardTitle>
                    <ArrowDownCircle className="h-4 w-4 text-red-500" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-red-500">-${stats.expense.toLocaleString()}</div>
                </CardContent>
            </Card>

            <Card className="col-span-2 row-span-2">
                <CardHeader>
                    <CardTitle>{t('financialSummary')}</CardTitle>
                </CardHeader>
                <CardContent className="h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={pieData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                            <XAxis type="number" hide />
                            <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 12 }} />
                            <Tooltip cursor={{ fill: 'transparent' }} content={<CustomTooltip />} />
                            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                                {pieData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.name === t('income') ? COLORS[0] : COLORS[1]} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>

            <Card className="col-span-2">
                <CardHeader>
                    <CardTitle>{t('expensesByCategory')}</CardTitle>
                </CardHeader>
                <CardContent className="h-[200px]">
                    {stats.expenseByCategory.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                                <Pie
                                    data={stats.expenseByCategory}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={40}
                                    outerRadius={60}
                                    paddingAngle={2}
                                    dataKey="value"
                                >
                                    {stats.expenseByCategory.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip content={<CustomTooltip />} />
                                <Legend
                                    layout="vertical"
                                    verticalAlign="middle"
                                    align="right"
                                    wrapperStyle={{ fontSize: '12px' }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-full flex items-center justify-center text-muted-foreground text-sm">{t('noData')}</div>
                    )}
                </CardContent>
            </Card>

            <Card className="col-span-2">
                <CardHeader>
                    <CardTitle>{t('incomeByCategory')}</CardTitle>
                </CardHeader>
                <CardContent className="h-[200px]">
                    {stats.incomeByCategory.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                                <Pie
                                    data={stats.incomeByCategory}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={40}
                                    outerRadius={60}
                                    paddingAngle={2}
                                    dataKey="value"
                                >
                                    {stats.incomeByCategory.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip content={<CustomTooltip />} />
                                <Legend
                                    layout="vertical"
                                    verticalAlign="middle"
                                    align="right"
                                    wrapperStyle={{ fontSize: '12px' }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-full flex items-center justify-center text-muted-foreground text-sm">{t('noData')}</div>
                    )}
                </CardContent>
            </Card>

            <Card className="col-span-2">
                <CardHeader>
                    <CardTitle>{t('topExpenses')}</CardTitle>
                </CardHeader>
                <CardContent className="h-[200px]">
                    {stats.topExpenses.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stats.topExpenses} layout="vertical" margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" width={90} tick={{ fontSize: 11 }} interval={0} />
                                <Tooltip cursor={{ fill: 'transparent' }} content={<CustomTooltip />} />
                                <Bar dataKey="value" radius={[0, 4, 4, 0]} fill="#ef4444" barSize={20} />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-full flex items-center justify-center text-muted-foreground text-sm">{t('noData')}</div>
                    )}
                </CardContent>
            </Card>

            <Card className="col-span-4 mt-4">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle>{t('balanceHistory')}</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={stats.balanceHistory} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8} />
                                    <stop offset="95%" stopColor="#8884d8" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" className="dark:stroke-gray-800" />
                            <XAxis
                                dataKey="date"
                                tickLine={false}
                                axisLine={false}
                                tick={{ fontSize: 12, fill: '#6b7280' }}
                                minTickGap={30}
                            />
                            <YAxis
                                hide
                                domain={['auto', 'auto']}
                            />
                            <Tooltip
                                contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                                labelStyle={{ fontWeight: 'bold', color: '#374151' }}
                                formatter={(value: number) => [`$${value.toLocaleString()}`, t('balance')]}
                            />
                            <Area
                                type="monotone"
                                dataKey="balance"
                                stroke="#8884d8"
                                strokeWidth={2}
                                fillOpacity={1}
                                fill="url(#colorBalance)"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>
        </div>
    )
}
