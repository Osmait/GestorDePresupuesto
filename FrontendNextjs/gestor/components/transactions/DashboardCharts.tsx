'use client'

import { ResponsivePie } from '@nivo/pie'
import { ResponsiveBar } from '@nivo/bar'
import { useTheme } from 'next-themes'
import { useMemo } from 'react'
import { CategoryExpense, MonthlySummary } from '@/types/analytics'


interface DashboardChartsProps {
	categories: { id: string, name: string, color: string }[]
	transactions: { amount: number, type_transation: string, category_id: string, created_at: string }[]
	categorysData: CategoryExpense[]
	monthSummary: MonthlySummary[]
}

export function DashboardCharts({ categorysData, monthSummary }: DashboardChartsProps) {
	const { theme } = useTheme()



	const truncate = (str: string, n: number) => str.length > n ? str.slice(0, n) : str

	const pieData = categorysData ? categorysData.map(cat => {
		return {
			...cat,
			id: truncate(cat.label || cat.id, 12),
			originalId: cat.id,
			originalLabel: cat.label,
			value: Math.abs(cat.value),
		}
	}) : []



	const barData = monthSummary ? monthSummary.map(month => {
		return {
			...month,
			Gastos: Math.abs(month.Gastos), // Asegurarse de que Gastos sea positivo
		}
	}) : []
	const nivoTheme = useMemo(() => ({
		background: 'transparent',
		textColor: theme === 'dark' ? '#e5e7eb' : '#374151',
		fontSize: 14,
		axis: {
			legend: { text: { fill: theme === 'dark' ? '#e5e7eb' : '#374151' } },
			ticks: { text: { fill: theme === 'dark' ? '#e5e7eb' : '#374151' } }
		},
		legends: {
			text: {
				fill: theme === 'dark' ? '#e5e7eb' : '#374151',
				fontSize: 13,
				fontWeight: 500
			}
		},
		tooltip: {
			container: {
				background: theme === 'dark' ? '#1f2937' : '#ffffff',
				color: theme === 'dark' ? '#e5e7eb' : '#374151',
				fontSize: 14,
				borderRadius: '8px',
				border: `1px solid ${theme === 'dark' ? '#374151' : '#d1d5db'}`,
				boxShadow: theme === 'dark'
					? '0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.1)'
					: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)'
			},
			basic: {
				whiteSpace: 'pre',
				display: 'flex',
				alignItems: 'center'
			},
			table: {},
			tableCell: {
				padding: '3px 5px'
			}
		}
	}), [theme])

	return (
		<div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
			<div className="bg-card rounded-xl border border-border/50 p-4 flex flex-col items-center">
				<h3 className="font-semibold mb-2 text-lg text-foreground">Gastos por Categoría</h3>
				<div className="h-64 w-full">
					{pieData.length > 0 ? (
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
							arcLinkLabelsTextColor={theme === 'dark' ? '#e5e7eb' : '#374151'}
							arcLinkLabelsColor={{ from: 'color' }}
							activeOuterRadiusOffset={8}
							theme={nivoTheme}

						/>
					) : (
						<div className="flex items-center justify-center h-full text-muted-foreground">
							<div className="text-center">
								<p className="text-lg mb-2">📊</p>
								<p>No hay gastos registrados</p>
								<p className="text-sm">Los gastos aparecerán aquí cuando realices transacciones</p>
							</div>
						</div>
					)}
				</div>
			</div>
			<div className="bg-card rounded-xl border border-border/50 p-4 flex flex-col items-center">
				<h3 className="font-semibold mb-2 text-lg text-foreground">Ingresos vs Gastos por Mes</h3>
				<div className="h-64 w-full">
					{barData.length > 0 ? (
						<ResponsiveBar
							data={barData}
							keys={['Ingresos', 'Gastos']}
							indexBy="month"
							margin={{ top: 30, right: 30, bottom: 80, left: 50 }}
							padding={0.3}
							groupMode="grouped"
							colors={[theme === 'dark' ? '#34d399' : '#10b981', theme === 'dark' ? '#f87171' : '#ef4444']}
							borderRadius={4}
							enableLabel={false}
							theme={nivoTheme}
							axisBottom={{
								format: v => {
									const [year, month] = v.split('-');
									return `${month}/${year.slice(2)}`;
								},
								legend: 'Mes',
								legendPosition: 'middle',
								legendOffset: 32
							}}
							axisLeft={{
								legend: 'Monto ($)',
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
									itemTextColor: theme === 'dark' ? '#e5e7eb' : '#374151',
									itemBackground: 'transparent',
									effects: [
										{
											on: 'hover',
											style: {
												itemTextColor: theme === 'dark' ? '#ffffff' : '#000000'
											}
										}
									]
								}
							]}
						/>
					) : (
						<div className="flex items-center justify-center h-full text-muted-foreground">
							<div className="text-center">
								<p className="text-lg mb-2">📈</p>
								<p>No hay transacciones registradas</p>
								<p className="text-sm">Las estadísticas aparecerán cuando tengas ingresos y gastos</p>
							</div>
						</div>
					)}
				</div>
			</div>
		</div>
	)
} 
