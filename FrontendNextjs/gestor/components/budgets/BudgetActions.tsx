'use client'

import { PlusCircle } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { useBudgetContext } from './BudgetContext'

export function BudgetActions() {
	const t = useTranslations('budgets')
	const { setModalOpen, setEditingBudget } = useBudgetContext()

	const handleCreate = () => {
		setEditingBudget(null)
		setModalOpen(true)
	}

	return (
		<div className='flex items-center gap-3'>
			<Button
				className='bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70'
				onClick={handleCreate}
			>
				<PlusCircle className='h-4 w-4 mr-2' />
				{t('addBudget')}
			</Button>
		</div>
	)
}
