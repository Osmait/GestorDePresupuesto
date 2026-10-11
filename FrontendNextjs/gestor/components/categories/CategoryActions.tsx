'use client'

import { Plus } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useCategoryContext } from '@/components/categories/CategoryContext'
import { Button } from '@/components/ui/button'
import { CategoryFormModal } from './CategoryFormModal'

/** Page-level "New category" button and the create/edit dialog (state lives in CategoryContext). */
export function CategoryActions() {
	const t = useTranslations('categories')
	const { createCategory, setEditingCategory, isModalOpen, setModalOpen } = useCategoryContext()

	return (
		<>
			<Button
				onClick={() => {
					setEditingCategory(null)
					setModalOpen(true)
				}}
			>
				<Plus className='mr-2 h-4 w-4' aria-hidden='true' />
				{t('addCategory')}
			</Button>
			<CategoryFormModal open={isModalOpen} setOpen={setModalOpen} onCreateCategory={createCategory} />
		</>
	)
}
