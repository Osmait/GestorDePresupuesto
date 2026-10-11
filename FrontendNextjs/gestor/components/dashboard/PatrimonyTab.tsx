'use client'

import { FileCheck, Landmark, PieChart, PiggyBank, TrendingUp } from 'lucide-react'
import dynamic from 'next/dynamic'
import { useChartTheme } from '@/components/charts/chart-theme'
import { Amount } from '@/components/shared/Amount'
import { EmptyState } from '@/components/shared/EmptyState'
import { StatCard } from '@/components/shared/StatCard'
import { StatGrid } from '@/components/shared/StatGrid'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useFormatCurrency } from '@/hooks/useFormatCurrency'
import { useFormatPercent } from '@/hooks/useFormatPercent'

// Nivo loads in its own chunk: this tab is not the dashboard's default one.
const PatrimonyPieChart = dynamic(() => import('@/components/charts/PatrimonyPieChart'), {
	ssr: false,
	loading: () => <div className='h-full w-full rounded bg-muted/20 animate-pulse' />,
})

interface PatrimonyTabProps {
	accountsTotal: number
	investmentsTotal: number
	investmentsTotalUSD?: number
	certificatesTotal: number
	accountsCount: number
	investmentsCount: number
	certificatesCount: number
	exchangeRate?: number
	/** App locale (`es` | `en`); kept for API compatibility, formatting follows the active locale. */
	locale?: string
	labels: {
		title: string
		accounts: string
		investments: string
		certificates: string
		total: string
		activeItems: string
		exchangeRate: string
		distribution: string
		noData: string
	}
}

/** Net worth split by accounts, investments and certificates (all DOP, from the dashboard summary). */
export function PatrimonyTab({
	accountsTotal,
	investmentsTotal,
	investmentsTotalUSD,
	certificatesTotal,
	accountsCount,
	investmentsCount,
	certificatesCount,
	exchangeRate,
	labels,
}: PatrimonyTabProps) {
	const formatCurrency = useFormatCurrency()
	const formatPercent = useFormatPercent()
	const { colors } = useChartTheme()
	const formatDOP = (value: number) => formatCurrency(value, 'DOP')
	const totalPatrimony = accountsTotal + investmentsTotal + certificatesTotal
	const countHint = (count: number) => `${count} ${labels.activeItems}`

	// Series colors in fixed entity order (accounts, investments, certificates).
	const pieData = [
		{ label: labels.accounts, value: accountsTotal, color: colors.series[0] },
		{ label: labels.investments, value: investmentsTotal, color: colors.series[1] },
		{ label: labels.certificates, value: certificatesTotal, color: colors.series[2] },
	].filter((d) => d.value > 0)

	return (
		<div className='space-y-6'>
			<StatGrid>
				<StatCard
					label={labels.total}
					icon={PiggyBank}
					value={<Amount value={totalPatrimony} currency='DOP' />}
					hint={
						exchangeRate ? (
							<>
								{labels.exchangeRate}: <Amount value={exchangeRate} currency='DOP' />
							</>
						) : undefined
					}
				/>
				<StatCard
					label={labels.accounts}
					icon={Landmark}
					value={<Amount value={accountsTotal} currency='DOP' />}
					hint={countHint(accountsCount)}
				/>
				<StatCard
					label={labels.investments}
					icon={TrendingUp}
					value={<Amount value={investmentsTotal} currency='DOP' />}
					hint={
						investmentsTotalUSD !== undefined ? (
							<>
								<Amount value={investmentsTotalUSD} currency='USD' /> · {countHint(investmentsCount)}
							</>
						) : (
							countHint(investmentsCount)
						)
					}
				/>
				<StatCard
					label={labels.certificates}
					icon={FileCheck}
					value={<Amount value={certificatesTotal} currency='DOP' />}
					hint={countHint(certificatesCount)}
				/>
			</StatGrid>

			<Card>
				<CardHeader>
					<CardTitle className='text-base'>{labels.distribution}</CardTitle>
				</CardHeader>
				<CardContent>
					{pieData.length > 0 ? (
						<div className='grid grid-cols-1 items-center gap-6 md:grid-cols-2'>
							<div className='h-[250px] w-full min-w-0'>
								<PatrimonyPieChart
									data={pieData}
									total={totalPatrimony}
									formatValue={formatDOP}
									ariaLabel={labels.distribution}
								/>
							</div>
							<ul className='divide-y'>
								{pieData.map((item) => (
									<li key={item.label} className='flex items-center justify-between gap-3 py-3'>
										<span className='flex min-w-0 items-center gap-2 text-sm'>
											<span
												className='h-2.5 w-2.5 shrink-0 rounded-full'
												style={{ backgroundColor: item.color }}
												aria-hidden='true'
											/>
											<span className='truncate'>{item.label}</span>
										</span>
										<span className='shrink-0 text-right'>
											<Amount value={item.value} currency='DOP' className='text-sm font-medium' />
											<span className='block text-xs text-muted-foreground tabular-nums'>
												{formatPercent(totalPatrimony > 0 ? (item.value / totalPatrimony) * 100 : 0)}
											</span>
										</span>
									</li>
								))}
							</ul>
						</div>
					) : (
						<EmptyState compact icon={PieChart} title={labels.noData} />
					)}
				</CardContent>
			</Card>
		</div>
	)
}
