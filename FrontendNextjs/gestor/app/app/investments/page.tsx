'use client'

import { ArrowRightLeft, Plus, TrendingUp } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { InvestmentDashboard } from '@/components/investments/InvestmentDashboard'
import { InvestmentFormModal } from '@/components/investments/InvestmentFormModal'
import { InvestmentFundingModal } from '@/components/investments/InvestmentFundingModal'
import { InvestmentList } from '@/components/investments/InvestmentList'
import { InvestmentSummaryCards } from '@/components/investments/InvestmentSummaryCards'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { ModuleDisabled } from '@/components/shared/ModuleDisabled'
import { PageHeader } from '@/components/shared/PageHeader'
import { PageShell } from '@/components/shared/PageShell'
import { PageTabs } from '@/components/shared/PageTabs'
import { Button } from '@/components/ui/button'
import { useGetInvestments } from '@/hooks/queries/useInvestmentsQuery'
import { useFeatureFlags } from '@/hooks/useFeatureFlags'
import { Investment, InvestmentType } from '@/types/investment'

const EMPTY_METRICS = { totalValue: 0, totalCost: 0, totalProfit: 0, roi: 0 }
const TYPES = [InvestmentType.STOCK, InvestmentType.CRYPTO, InvestmentType.FIXED_INCOME] as const

export default function InvestmentsPage() {
	const t = useTranslations('investments')
	const { isEnabled, isLoading: isFeatureFlagsLoading } = useFeatureFlags()

	if (isFeatureFlagsLoading) {
		return (
			<PageShell aria-busy='true'>
				<PageHeader title={t('title')} description={t('subtitle')} />
				<InvestmentSummaryCards metrics={EMPTY_METRICS} loading />
			</PageShell>
		)
	}

	if (!isEnabled('module_investments')) {
		return <ModuleDisabled title={t('title')} />
	}

	return <InvestmentsContent />
}

/** The page once the module is on (queries only run from here). */
function InvestmentsContent() {
	const t = useTranslations('investments')
	const [isModalOpen, setIsModalOpen] = useState(false)
	const [isFundingModalOpen, setIsFundingModalOpen] = useState(false)
	const [investmentToEdit, setInvestmentToEdit] = useState<Investment | null>(null)
	const { data: investments, isLoading, isError, refetch } = useGetInvestments()
	// No positions at all: one empty state instead of empty charts plus an empty list per tab.
	const isEmpty = !isLoading && !isError && (investments?.length ?? 0) === 0

	const handleEdit = (investment: Investment) => {
		setInvestmentToEdit(investment)
		setIsModalOpen(true)
	}

	const handleAdd = () => {
		setInvestmentToEdit(null)
		setIsModalOpen(true)
	}

	const header = (
		<PageHeader
			title={t('title')}
			description={t('subtitle')}
			actions={
				<>
					<Button variant='outline' onClick={() => setIsFundingModalOpen(true)}>
						<ArrowRightLeft className='mr-2 h-4 w-4' aria-hidden='true' />
						{t('fundBroker')}
					</Button>
					<Button onClick={handleAdd}>
						<Plus className='mr-2 h-4 w-4' aria-hidden='true' />
						{t('addInvestment')}
					</Button>
				</>
			}
		/>
	)

	return (
		<PageShell>
			{header}

			{isError ? (
				<ErrorState title={t('loadErrorTitle')} onRetry={() => void refetch()} />
			) : isEmpty ? (
				<EmptyState
					icon={TrendingUp}
					title={t('emptyTitle')}
					description={t('emptyDescription')}
					action={
						<Button onClick={handleAdd}>
							<Plus className='mr-2 h-4 w-4' aria-hidden='true' />
							{t('addInvestment')}
						</Button>
					}
				/>
			) : (
				<>
					<InvestmentDashboard />

					<PageTabs
						urlParam='type'
						defaultValue={InvestmentType.STOCK}
						aria-label={t('typesLabel')}
						tabs={TYPES.map((type) => ({
							value: type,
							label: t(`types.${type}`),
							content: <InvestmentList type={type} onEdit={handleEdit} onAdd={handleAdd} />,
						}))}
					/>
				</>
			)}

			{isModalOpen && (
				<InvestmentFormModal
					isOpen={isModalOpen}
					onClose={() => setIsModalOpen(false)}
					investmentToEdit={investmentToEdit}
				/>
			)}

			{isFundingModalOpen && (
				<InvestmentFundingModal isOpen={isFundingModalOpen} onClose={() => setIsFundingModalOpen(false)} />
			)}
		</PageShell>
	)
}
