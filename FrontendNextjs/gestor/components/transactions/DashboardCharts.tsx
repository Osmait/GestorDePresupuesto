'use client'

import { ResponsivePie } from '@nivo/pie'
import { ResponsiveBar } from '@nivo/bar'
import { useTheme } from 'next-themes'
import { useMemo } from 'react'

interface CategoryData {
	id: string
	label: string
	value: number
	color: string
}

interface BarData {
	month: string
	Ingresos: number
	Gastos: number
}

interface DashboardChartsProps {
	categories: { id: string, name: string, color: string }[]
	transactions: { amount: number, type_transaction: string, category_id: string, created_at: string }[]
}

export function DashboardCharts({ categories, transactions }: DashboardChartsProps) {
	console.log('DashboardCharts categories:', categories)
	console.log('DashboardCharts transactions:', transactions)
	const { theme } = useTheme()

	// Filtrar solo transacciones del mes y año actual
	const now = new Date()
	const currentMonth = now.getMonth() + 1
	const currentYear = now.getFullYear()
	const currentMonthTransactions = useMemo(() => transactions.filter(tx => {
		const date = tx.created_at instanceof Date ? tx.created_at : new Date(tx.created_at)
		return (date.getMonth() + 1) === currentMonth && date.getFullYear() === currentYear
	}), [transactions, currentMonth, currentYear])

	// Normalizar type_transaction
	const normalizedTransactions = useMemo(() => (Array.isArray(currentMonthTransactions) ? currentMonthTransactions : []).map(t => ({
		...t,
		type_transaction: t.type_transaction === '0' ? 'BILL'
			: t.type_transaction === '1' ? 'INCOME'
			: t.type_transaction
	})), [currentMonthTransactions])

	// Pie: Distribución de gastos por categoría
	const pieData: CategoryData[] = useMemo(() => {
		const gastos = normalizedTransactions.filter(t => t.type_transaction === 'BILL')
		const grouped: Record<string, number> = {}
		gastos.forEach(t => {
			grouped[t.category_id] = (grouped[t.category_id] || 0) + t.amount
		})
		const data = Array.isArray(categories) ? categories.map(cat => ({
			id: cat.id,
			label: cat.name,
			value: grouped[cat.id] || 0,
			color: cat.color
		})).filter(d => d.value > 0) : [];
		console.log('Pie chart data:', data)
		return data
	}, [categories, normalizedTransactions])

	// Bar: Ingresos vs Gastos por mes
	const barData: BarData[] = useMemo(() => {
		const byMonth: Record<string, { Ingresos: number, Gastos: number }> = {}
		normalizedTransactions.forEach(t => {
			const date = new Date(t.created_at)
			const month = `${date.getFullYear()}-${(date.getMonth()+1).toString().padStart(2,'0')}`
			if (!byMonth[month]) byMonth[month] = { Ingresos: 0, Gastos: 0 }
			if (t.type_transaction === 'INCOME') byMonth[month].Ingresos += t.amount
			if (t.type_transaction === 'BILL') byMonth[month].Gastos += t.amount
		})
		const data = Object.entries(byMonth).sort(([a],[b]) => a.localeCompare(b)).map(([month, vals]) => ({ month, ...vals }))
		console.log('Bar chart data:', data)
		return data
	}, [normalizedTransactions])

	const nivoTheme = useMemo(() => ({
		background: 'transparent',
		textColor: theme === 'dark' ? '#e5e7eb' : '#222',
		fontSize: 14,
		axis: {
			legend: { text: { fill: theme === 'dark' ? '#e5e7eb' : '#222' } },
			ticks: { text: { fill: theme === 'dark' ? '#e5e7eb' : '#222' } }
		},
		legends: { text: { fill: theme === 'dark' ? '#e5e7eb' : '#222' } }
	}), [theme])

	return (
		<div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
			<div className="bg-card rounded-xl shadow-lg p-4 flex flex-col items-center">
				<h3 className="font-semibold mb-2 text-lg text-foreground">Gastos por Categoría</h3>
				<div className="h-64 w-full">
					<ResponsivePie
						data={pieData}
						margin={{ top: 30, right: 40, bottom: 40, left: 40 }}
						innerRadius={0.6}
						padAngle={1.5}
						cornerRadius={6}
						colors={d => d.data.color}
						borderWidth={2}
						borderColor={{ from: 'color', modifiers: [['darker', 0.3]] }}
						enableArcLabels={false}
						arcLinkLabelsTextColor={theme === 'dark' ? '#e5e7eb' : '#222'}
						arcLinkLabelsColor={{ from: 'color' }}
						activeOuterRadiusOffset={8}
						theme={nivoTheme}
						legends={[
							{
								anchor: 'bottom',
								direction: 'row',
								justify: false,
								translateY: 36,
								itemWidth: 80,
								itemHeight: 18,
								itemsSpacing: 8,
								symbolSize: 18,
								symbolShape: 'circle',
								itemTextColor: theme === 'dark' ? '#e5e7eb' : '#222',
							}
						]}
					/>
				</div>
			</div>
			<div className="bg-card rounded-xl shadow-lg p-4 flex flex-col items-center">
				<h3 className="font-semibold mb-2 text-lg text-foreground">Ingresos vs Gastos por Mes</h3>
				<div className="h-64 w-full">
					<ResponsiveBar
						data={barData}
						keys={['Ingresos','Gastos']}
						indexBy="month"
						margin={{ top: 30, right: 30, bottom: 80, left: 50 }}
						padding={0.3}
						groupMode="grouped"
						colors={[theme === 'dark' ? '#34d399' : '#2563eb', theme === 'dark' ? '#f87171' : '#f59e42']}
						borderRadius={4}
						enableLabel={false}
						theme={nivoTheme}
						axisBottom={{
							format: v => v.replace(/\d{4}-/,'') + '/' + v.slice(2,4),
							legend: 'Mes',
							legendPosition: 'middle',
							legendOffset: 32
						}}
						axisLeft={{
							legend: 'Monto',
							legendPosition: 'middle',
							legendOffset: -40
						}}
						legends={[
							{
								dataFrom: 'keys',
								anchor: 'bottom',
								direction: 'row',
								justify: false,
								translateY: 60,
								itemWidth: 80,
								itemHeight: 18,
								itemsSpacing: 8,
								symbolSize: 18,
								itemTextColor: theme === 'dark' ? '#e5e7eb' : '#222',
							}
						]}
					/>
				</div>
			</div>
		</div>
	)
} 