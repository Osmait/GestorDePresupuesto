'use client'

import { CreditCard, DollarSign, FileCheck, LucideIcon, PiggyBank, TrendingUp } from 'lucide-react'
import dynamic from 'next/dynamic'
import { AnimatedCounter } from '@/components/ui/animated-counter'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils'

// Nivo loads in its own chunk: this tab is not the dashboard's default one.
const PatrimonyPieChart = dynamic(() => import('@/components/charts/PatrimonyPieChart'), {
	ssr: false,
	loading: () => <div className='h-full w-full rounded bg-muted/20 animate-pulse' />,
})

interface PatrimonyData {
	label: string
	value: number
	color: string
	count: number
}

interface PatrimonyTabProps {
	accountsTotal: number
	investmentsTotal: number
	investmentsTotalUSD?: number
	certificatesTotal: number
	accountsCount: number
	investmentsCount: number
	certificatesCount: number
	exchangeRate?: number
	/** App locale (`es` | `en`); totals are DOP amounts from the dashboard summary. */
	locale: string
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

interface CategoryCardProps {
	title: string
	value: number
	count: number
	countLabel: string
	icon: LucideIcon
	color: string
	subtitle?: string
	locale: string
}

function CategoryCard({ title, value, count, countLabel, icon: Icon, color, subtitle, locale }: CategoryCardProps) {
	return (
		<Card className='border-border/50 dark:border-border/20'>
			<CardContent className='p-6'>
				<div className={`rounded-lg p-4 bg-gradient-to-br ${color}`}>
					<div className='flex items-center justify-between mb-3'>
						<Icon className='h-6 w-6' />
					</div>
					<p className='text-sm font-medium text-muted-foreground mb-1'>{title}</p>
					<p className='text-xl sm:text-2xl font-bold text-foreground tabular-nums break-words'>
						<AnimatedCounter value={value} currency='DOP' locale={locale} />
					</p>
					{subtitle && <p className='text-xs text-muted-foreground mt-1'>{subtitle}</p>}
					<p className='text-xs text-muted-foreground mt-1'>
						{count} {countLabel}
					</p>
				</div>
			</CardContent>
		</Card>
	)
}

export function PatrimonyTab({
	accountsTotal,
	investmentsTotal,
	investmentsTotalUSD,
	certificatesTotal,
	accountsCount,
	investmentsCount,
	certificatesCount,
	exchangeRate,
	locale,
	labels,
}: PatrimonyTabProps) {
	const formatDOP = (value: number) => formatCurrency(value, 'DOP', { locale })
	const totalPatrimony = accountsTotal + investmentsTotal + certificatesTotal

	const pieData: PatrimonyData[] = [
		{
			label: labels.accounts,
			value: accountsTotal,
			color: 'hsl(217, 91%, 60%)',
			count: accountsCount,
		},
		{
			label: labels.investments,
			value: investmentsTotal,
			color: 'hsl(142, 71%, 45%)',
			count: investmentsCount,
		},
		{
			label: labels.certificates,
			value: certificatesTotal,
			color: 'hsl(262, 83%, 58%)',
			count: certificatesCount,
		},
	].filter((d) => d.value > 0)

	const hasData = pieData.length > 0

	// Format USD value for subtitle
	const investmentsSubtitle =
		investmentsTotalUSD !== undefined ? formatCurrency(investmentsTotalUSD, 'USD', { locale }) : undefined

	return (
		<div className='space-y-6'>
			{exchangeRate && (
				<Card className='border-border/50 dark:border-border/20'>
					<CardContent className='py-4'>
						<div className='flex flex-wrap items-center justify-between gap-2'>
							<div className='flex items-center gap-2'>
								<DollarSign className='h-5 w-5 text-muted-foreground' aria-hidden='true' />
								<span className='text-sm text-muted-foreground'>{labels.exchangeRate}</span>
							</div>
							<span className='text-lg font-bold tabular-nums'>{formatDOP(exchangeRate)}</span>
						</div>
					</CardContent>
				</Card>
			)}

			<div className='grid grid-cols-1 md:grid-cols-3 gap-6'>
				<CategoryCard
					title={labels.accounts}
					value={accountsTotal}
					count={accountsCount}
					countLabel={labels.activeItems}
					icon={CreditCard}
					color='from-blue-500/10 to-cyan-500/10 dark:from-blue-500/5 dark:to-cyan-500/5 text-blue-600 dark:text-blue-400'
					locale={locale}
				/>
				<CategoryCard
					title={labels.investments}
					value={investmentsTotal}
					count={investmentsCount}
					countLabel={labels.activeItems}
					icon={TrendingUp}
					color='from-green-500/10 to-emerald-500/10 dark:from-green-500/5 dark:to-emerald-500/5 text-green-600 dark:text-green-400'
					subtitle={investmentsSubtitle}
					locale={locale}
				/>
				<CategoryCard
					title={labels.certificates}
					value={certificatesTotal}
					count={certificatesCount}
					countLabel={labels.activeItems}
					icon={FileCheck}
					color='from-purple-500/10 to-violet-500/10 dark:from-purple-500/5 dark:to-violet-500/5 text-purple-600 dark:text-purple-400'
					locale={locale}
				/>
			</div>

			<div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
				<Card className='border-border/50 dark:border-border/20'>
					<CardHeader>
						<CardTitle className='flex items-center gap-2 text-foreground'>
							<PiggyBank className='h-5 w-5' />
							{labels.total}
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className='text-center py-6'>
							<p className='text-3xl sm:text-5xl font-bold text-foreground mb-2 tabular-nums break-words'>
								<AnimatedCounter value={totalPatrimony} currency='DOP' locale={locale} />
							</p>
							<p className='text-muted-foreground'>{labels.total}</p>
						</div>
						<div className='grid grid-cols-3 gap-2 sm:gap-4 mt-4 pt-4 border-t'>
							{pieData.map((item) => (
								<div key={item.label} className='min-w-0 text-center'>
									<div className='w-3 h-3 rounded-full mx-auto mb-1' style={{ backgroundColor: item.color }} />
									<p className='text-xs text-muted-foreground break-words'>{item.label}</p>
									<p className='text-sm font-semibold'>
										{totalPatrimony > 0 ? ((item.value / totalPatrimony) * 100).toFixed(1) : 0}%
									</p>
								</div>
							))}
						</div>
					</CardContent>
				</Card>

				<Card className='border-border/50 dark:border-border/20'>
					<CardHeader>
						<CardTitle className='text-foreground'>{labels.distribution}</CardTitle>
					</CardHeader>
					<CardContent>
						{hasData ? (
							<div className='h-[250px] w-full min-w-0'>
								<PatrimonyPieChart data={pieData} total={totalPatrimony} formatValue={formatDOP} />
							</div>
						) : (
							<div className='h-[250px] flex items-center justify-center text-muted-foreground'>{labels.noData}</div>
						)}
					</CardContent>
				</Card>
			</div>
		</div>
	)
}
