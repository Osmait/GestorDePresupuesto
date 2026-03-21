'use client'

import { Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'
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
		return <div className='container mx-auto py-10'>Loading...</div>
	}

	if (!isInvestmentsModuleEnabled) {
		return (
			<div className='container mx-auto py-10 space-y-4'>
				<h1 className='text-2xl font-semibold tracking-tight'>Investments</h1>
				<p className='text-muted-foreground'>This module is currently disabled for your account.</p>
				<Button variant='outline' onClick={() => router.push('/app')}>
					Go to dashboard
				</Button>
			</div>
		)
	}

	return (
		<div className='container mx-auto py-10 space-y-8'>
			<div className='flex justify-between items-center'>
				<h1 className='text-3xl font-bold tracking-tight'>Investments</h1>
				<div className='flex items-center gap-2'>
					<Button variant='outline' onClick={() => setIsFundingModalOpen(true)}>
						Fund Broker
					</Button>
					<Button onClick={() => setIsModalOpen(true)}>
						<Plus className='mr-2 h-4 w-4' /> Add Investment
					</Button>
				</div>
			</div>

			<InvestmentDashboard />

			<Tabs defaultValue={InvestmentType.STOCK} className='space-y-4'>
				<TabsList className='grid w-full grid-cols-3 md:w-[400px]'>
					<TabsTrigger value={InvestmentType.STOCK}>Stocks</TabsTrigger>
					<TabsTrigger value={InvestmentType.CRYPTO}>Crypto</TabsTrigger>
					<TabsTrigger value={InvestmentType.FIXED_INCOME}>Fixed Income</TabsTrigger>
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
