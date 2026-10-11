'use client'

import { Plus } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { useBudgetContext } from './BudgetContext'

/** Page-level "New budget" button; the dialog itself lives in BudgetList (context state). */
export function BudgetActions() {
	const t = useTranslations('budgets')
	const { setModalOpen, setEditingBudget } = useBudgetContext()

	const handleCreate = () => {
		setEditingBudget(null)
		setModalOpen(true)
	}

	return (
		<Button onClick={handleCreate}>
			<Plus className='mr-2 h-4 w-4' aria-hidden='true' />
			{t('addBudget')}
		</Button>
	)
}
