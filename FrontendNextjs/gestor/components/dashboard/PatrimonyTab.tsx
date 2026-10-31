'use client'

import { Briefcase, CreditCard, FileCheck, HandCoins, Landmark, PieChart, PiggyBank, TrendingUp } from 'lucide-react'
import dynamic from 'next/dynamic'
import { useChartTheme } from '@/components/charts/chart-theme'
import { Amount } from '@/components/shared/Amount'
import { EmptyState } from '@/components/shared/EmptyState'
import { StatCard } from '@/components/shared/StatCard'
import { StatGrid, type StatGridColumns } from '@/components/shared/StatGrid'
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
	/** Broker wallet cash (funded, not invested), in DOP. */
	brokerCashTotal?: number
	/** Outstanding principal of active loans, in DOP. */
	loansReceivableTotal?: number
	loansReceivableCount?: number
	/** Outstanding principal of defaulted loans, in DOP: shown apart, not added. */
	loansDefaultedTotal?: number
	/** Net worth from the API; computed from the components when absent (older API). */
	netWorth?: number
	/** What is owed on credit cards, in DOP; subtracted from the total. */
	creditCardDebt?: number
	creditCardsCount?: number
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
		brokerCash?: string
		loansReceivable?: string
		loansDefaulted?: string
		cardDebt: string
		total: string
		activeItems: string
		exchangeRate: string
		distribution: string
		noData: string
	}
}

/**
 * Net worth split by component (all DOP, from the dashboard summary): accounts,
 * investments, broker cash, certificates and loans receivable, minus card debt.
 */
export function PatrimonyTab({
	accountsTotal,
	investmentsTotal,
	investmentsTotalUSD,
	certificatesTotal,
	brokerCashTotal = 0,
	loansReceivableTotal = 0,
	loansReceivableCount = 0,
	loansDefaultedTotal = 0,
	netWorth,
	creditCardDebt = 0,
	creditCardsCount = 0,
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
	// Net worth: what the user has minus what they owe on cards. The
	// distribution chart splits only what they have (the assets).
	// Moving money between them (funding the broker, lending) leaves the total unchanged.
	const totalAssets = accountsTotal + investmentsTotal + brokerCashTotal + certificatesTotal + loansReceivableTotal
	const totalPatrimony = netWorth ?? totalAssets - creditCardDebt
	const countHint = (count: number) => `${count} ${labels.activeItems}`
	const showBrokerCash = brokerCashTotal !== 0
	const showLoans = loansReceivableTotal !== 0 || loansDefaultedTotal > 0
	const cardCount = 4 + (showBrokerCash ? 1 : 0) + (showLoans ? 1 : 0) + (creditCardsCount > 0 ? 1 : 0)
	const columns: StatGridColumns = cardCount === 5 ? 5 : cardCount === 6 ? 3 : 4

	// Series colors in fixed entity order (accounts, investments, certificates, broker cash, loans).
	const pieData = [
		{ label: labels.accounts, value: accountsTotal, color: colors.series[0] },
		{ label: labels.investments, value: investmentsTotal, color: colors.series[1] },
		{ label: labels.certificates, value: certificatesTotal, color: colors.series[2] },
		{ label: labels.brokerCash ?? 'Broker', value: brokerCashTotal, color: colors.series[3 % colors.series.length] },
		{
			label: labels.loansReceivable ?? 'Loans',
			value: loansReceivableTotal,
			color: colors.series[4 % colors.series.length],
		},
	].filter((d) => d.value > 0)

	return (
		<div className='space-y-6'>
			<StatGrid columns={columns}>
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
				{showBrokerCash ? (
					<StatCard
						label={labels.brokerCash ?? 'Broker'}
						icon={Briefcase}
						value={<Amount value={brokerCashTotal} currency='DOP' />}
					/>
				) : null}
				<StatCard
					label={labels.certificates}
					icon={FileCheck}
					value={<Amount value={certificatesTotal} currency='DOP' />}
					hint={countHint(certificatesCount)}
				/>
				{showLoans ? (
					<StatCard
						label={labels.loansReceivable ?? 'Loans'}
						icon={HandCoins}
						value={<Amount value={loansReceivableTotal} currency='DOP' />}
						hint={
							loansDefaultedTotal > 0 ? (
								<>
									{labels.loansDefaulted ?? 'Defaulted'}: <Amount value={loansDefaultedTotal} currency='DOP' />
								</>
							) : (
								countHint(loansReceivableCount)
							)
						}
					/>
				) : null}
				{creditCardsCount > 0 ? (
					<StatCard
						label={labels.cardDebt}
						icon={CreditCard}
						value={<Amount value={-creditCardDebt} currency='DOP' tone={creditCardDebt > 0 ? 'negative' : 'neutral'} />}
						hint={countHint(creditCardsCount)}
					/>
				) : null}
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
									total={totalAssets}
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
												{formatPercent(totalAssets > 0 ? (item.value / totalAssets) * 100 : 0)}
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
