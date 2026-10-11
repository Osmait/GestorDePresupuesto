'use client'

import { PiggyBank, Receipt, TrendingUp, Wallet } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Amount } from '@/components/shared/Amount'
import { StatCard } from '@/components/shared/StatCard'
import { StatGrid } from '@/components/shared/StatGrid'
import { CertificateSummary } from '@/types/certificate'

interface CertificateSummaryCardProps {
	/** `undefined` while loading: the cards show skeletons. */
	summary: CertificateSummary | undefined
}

// The summary endpoint aggregates without a currency; amounts are reported in DOP.
const SUMMARY_CURRENCY = 'DOP'

export function CertificateSummaryCard({ summary }: CertificateSummaryCardProps) {
	const t = useTranslations('certificates.summary')
	const loading = !summary

	return (
		<StatGrid columns={4}>
			<StatCard
				label={t('totalCapital')}
				icon={Wallet}
				loading={loading}
				value={<Amount value={summary?.total_capital ?? 0} currency={SUMMARY_CURRENCY} />}
				hint={t('activeCertificates', { count: summary?.active_certificates ?? 0 })}
			/>
			<StatCard
				label={t('netInterestEarned')}
				icon={TrendingUp}
				loading={loading}
				value={<Amount value={summary?.total_net_interest ?? 0} currency={SUMMARY_CURRENCY} tone='auto' />}
			/>
			<StatCard
				label={t('taxesWithheld')}
				icon={Receipt}
				loading={loading}
				value={<Amount value={summary?.total_tax_withheld ?? 0} currency={SUMMARY_CURRENCY} />}
			/>
			<StatCard
				label={t('portfolioValue')}
				icon={PiggyBank}
				loading={loading}
				value={<Amount value={summary?.portfolio_value ?? 0} currency={SUMMARY_CURRENCY} />}
			/>
		</StatGrid>
	)
}
