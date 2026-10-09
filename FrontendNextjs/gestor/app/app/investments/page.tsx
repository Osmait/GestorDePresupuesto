'use client'

import { Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { InvestmentDashboard } from '@/components/investments/InvestmentDashboard'
import { InvestmentFormModal } from '@/components/investments/InvestmentFormModal'
import { InvestmentFundingModal } from '@/components/investments/InvestmentFundingModal'
import { InvestmentList } from '@/components/investments/InvestmentList'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useFeatureFlags } from '@/hooks/useFeatureFlags'
import { Investment, InvestmentType } from '@/types/investment'

export default function InvestmentsPage() {
	const t = useTranslations('investments')
	const tCommon = useTranslations('common.moduleDisabled')
	const [isModalOpen, setIsModalOpen] = useState(false)
	const [isFundingModalOpen, setIsFundingModalOpen] = useState(false)
	const [investmentToEdit, setInvestmentToEdit] = useState<Investment | null>(null)
	const router = useRouter()
	const { isEnabled, isLoading: isFeatureFlagsLoading } = useFeatureFlags()
	const isInvestmentsModuleEnabled = isEnabled('module_investments')

	const handleEdit = (investment: Investment) => {
		setInvestmentToEdit(investment)
		setIsModalOpen(true)
	}

	if (isFeatureFlagsLoading) {
		return <div className='container mx-auto px-4 py-8 text-muted-foreground'>{t('loading')}</div>
	}

	if (!isInvestmentsModuleEnabled) {
		return (
			<div className='container mx-auto px-4 py-8 space-y-4'>
				<h1 className='text-2xl font-semibold tracking-tight'>{t('title')}</h1>
				<p className='text-muted-foreground'>{tCommon('message')}</p>
				<Button variant='outline' onClick={() => router.push('/app')}>
					{tCommon('goToDashboard')}
				</Button>
			</div>
		)
	}

	return (
		<div className='container mx-auto px-4 py-8 space-y-6'>
			<div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
				<h1 className='text-3xl font-bold tracking-tight'>{t('title')}</h1>
				<div className='flex flex-wrap gap-2'>
					<Button variant='outline' className='flex-1 sm:flex-none' onClick={() => setIsFundingModalOpen(true)}>
						{t('fundBroker')}
					</Button>
					<Button
						className='flex-1 sm:flex-none'
						onClick={() => {
							setInvestmentToEdit(null)
							setIsModalOpen(true)
						}}
					>
						<Plus className='mr-2 h-4 w-4' /> {t('addInvestment')}
					</Button>
				</div>
			</div>

			<InvestmentDashboard />

			<Tabs defaultValue={InvestmentType.STOCK} className='space-y-4'>
				<TabsList className='grid w-full grid-cols-3 md:w-[400px]'>
					<TabsTrigger value={InvestmentType.STOCK} className='px-2'>
						{t('types.stock')}
					</TabsTrigger>
					<TabsTrigger value={InvestmentType.CRYPTO} className='px-2'>
						{t('types.crypto')}
					</TabsTrigger>
					<TabsTrigger value={InvestmentType.FIXED_INCOME} className='px-2'>
						{t('types.fixed_income')}
					</TabsTrigger>
				</TabsList>
				<TabsContent value={InvestmentType.STOCK} className='mt-4'>
					<InvestmentList type={InvestmentType.STOCK} onEdit={handleEdit} />
				</TabsContent>
				<TabsContent value={InvestmentType.CRYPTO} className='mt-4'>
					<InvestmentList type={InvestmentType.CRYPTO} onEdit={handleEdit} />
				</TabsContent>
				<TabsContent value={InvestmentType.FIXED_INCOME} className='mt-4'>
					<InvestmentList type={InvestmentType.FIXED_INCOME} onEdit={handleEdit} />
				</TabsContent>
			</Tabs>

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
		</div>
	)
}
