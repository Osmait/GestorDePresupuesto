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

export function DashboardCharts({ categories, transactions,categorysData,monthSummary}: DashboardChartsProps) {
	console.log('DashboardCharts categories:', categories)
	console.log('DashboardCharts transactions:', transactions)
  console.log('DashboardCharts categoríaData:', categorysData)
	const { theme } = useTheme()

	// Usar todas las transacciones disponibles (no solo del mes actual)
	const validTransactions = useMemo(() => 
		Array.isArray(transactions) ? transactions : [], 
	[transactions])

	console.log('Valid transactions:', validTransactions)


  const pieData = categorysData.map(cat => {
    return {
      ...cat,
      value: Math.abs(cat.value), 
    }
  })



  const barData = monthSummary.map(month => {
    return {
      ...month,
      Gastos : Math.abs(month.Gastos), // Asegurarse de que Gastos sea positivo
    }
  })
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
			<div className="bg-card rounded-xl shadow-lg p-4 flex flex-col items-center">
				<h3 className="font-semibold mb-2 text-lg text-foreground">Ingresos vs Gastos por Mes</h3>
				<div className="h-64 w-full">
					{barData.length > 0 ? (
						<ResponsiveBar
							data={barData}
							keys={['Ingresos','Gastos']}
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
									itemTextColor: theme === 'dark' ? '#e5e7eb' : '#222',
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
