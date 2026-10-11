'use client'

import { Plus, TrendingUp } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { EmptyState } from '@/components/shared/EmptyState'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useDeleteInvestmentMutation, useGetInvestments } from '@/hooks/queries/useInvestmentsQuery'
import { Investment, InvestmentType } from '@/types/investment'
import { InvestmentCard } from './InvestmentCard'

interface InvestmentListProps {
	type: InvestmentType
	onEdit: (_investment: Investment) => void
	/** Opens the create form from the empty state. */
	onAdd?: () => void
}

export function InvestmentList({ type, onEdit, onAdd }: InvestmentListProps) {
	const t = useTranslations('investments')
	const tCommon = useTranslations('common.confirm')
	const { data: investments, isLoading } = useGetInvestments()
	const deleteMutation = useDeleteInvestmentMutation()
	const [toDelete, setToDelete] = useState<Investment | null>(null)

	if (isLoading) {
		return (
			<div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
				{[1, 2, 3].map((i) => (
					<Card key={i}>
						<CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
							<Skeleton className='h-4 w-32' />
							<Skeleton className='h-8 w-8' />
						</CardHeader>
						<CardContent className='space-y-2'>
							<Skeleton className='h-8 w-32' />
							<Skeleton className='h-3 w-24' />
						</CardContent>
					</Card>
				))}
			</div>
		)
	}

	const filteredInvestments = investments?.filter((inv) => inv.type === type) || []

	if (filteredInvestments.length === 0) {
		return (
			<EmptyState
				icon={TrendingUp}
				title={t('list.emptyTitle')}
				description={t('list.emptyDescription')}
				action={
					onAdd ? (
						<Button onClick={onAdd}>
							<Plus className='mr-2 h-4 w-4' aria-hidden='true' />
							{t('addInvestment')}
						</Button>
					) : undefined
				}
			/>
		)
	}

	async function handleConfirmDelete() {
		if (!toDelete) return
		try {
			await deleteMutation.mutateAsync(toDelete.id)
		} catch (error) {
			toast.error(t('list.deleteError'))
			throw error
		}
	}

	return (
		<>
			<div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
				{filteredInvestments.map((investment) => (
					<InvestmentCard
						key={investment.id}
						investment={investment}
						onEdit={onEdit}
						onDelete={(id) => setToDelete(filteredInvestments.find((item) => item.id === id) ?? null)}
					/>
				))}
			</div>

			<ConfirmDialog
				open={toDelete !== null}
				onOpenChange={(open) => !open && setToDelete(null)}
				title={t('list.deleteTitle', { name: toDelete?.name ?? '' })}
				description={tCommon('irreversible')}
				destructive
				onConfirm={handleConfirmDelete}
			/>
		</>
	)
}
