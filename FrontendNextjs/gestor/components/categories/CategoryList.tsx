'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { Tag } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useEffect } from 'react'
import { useCategoryContext } from '@/components/categories/CategoryContext'
import { AnimatedTabs } from '@/components/common/animated-tabs'
import { CategoriesSkeleton } from '@/components/skeletons/categories-skeleton'
import { useGetDashboardSummary } from '@/hooks/queries/useAnalyticsQuery'
import { useDeleteCategoryMutation, useGetCategories } from '@/hooks/queries/useCategoriesQuery'
import { Category } from '@/types/category'
import { CategoryCard } from './CategoryCard'
import { CategorySummaryCard } from './CategorySummaryCard'

export function CategoryList() {
	const t = useTranslations('categories')
	const { data: categoriesData, isLoading: isLoadingCategories } = useGetCategories()
	const { data: dashboardSummary, isLoading: isLoadingDashboardSummary } = useGetDashboardSummary()
	const categories = categoriesData ?? []
	const categoryExpenses = dashboardSummary?.category_expenses ?? []
	const categoryStatsById = new Map(categoryExpenses.map((item) => [item.id, item]))
	const { setEditingCategory, setModalOpen } = useCategoryContext()
	const searchParams = useSearchParams()
	const selectedCategoryId = searchParams.get('selected') || ''

	const deleteCategoryMutation = useDeleteCategoryMutation()

	const isLoading = isLoadingCategories || isLoadingDashboardSummary

	const handleDeleteCategory = async (categoryId: string) => {
		await deleteCategoryMutation.mutateAsync(categoryId)
	}

	const handleEditCategory = (category: Category) => {
		setEditingCategory(category)
		setModalOpen(true)
	}

	useEffect(() => {
		if (!selectedCategoryId) return
		const element = document.getElementById(`category-card-${selectedCategoryId}`)
		if (!element) return
		element.scrollIntoView({ behavior: 'smooth', block: 'center' })
	}, [selectedCategoryId])

	if (isLoading) {
		return <CategoriesSkeleton />
	}

	return (
		<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
			<div className='mb-8'>
				<CategorySummaryCard categories={categories} categoryExpenses={categoryExpenses} />
			</div>

			<AnimatedTabs
				defaultValue='all'
				tabs={[
					{
						value: 'all',
						label: t('all'),
						icon: <Tag className='h-4 w-4' />,
						content: (
							<div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
								<AnimatePresence mode='popLayout' initial={false}>
									{categories.map((category) => (
										<motion.div
											key={category.id}
											id={`category-card-${category.id}`}
											initial={{ opacity: 0, y: 15 }}
											animate={{ opacity: 1, y: 0 }}
											exit={{ opacity: 0, scale: 0.95 }}
											transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
											className={
												selectedCategoryId === category.id
													? 'rounded-xl ring-2 ring-primary/70 ring-offset-2 ring-offset-background'
													: ''
											}
										>
											<CategoryCard
												category={category}
												stats={categoryStatsById.get(category.id || '')}
												onDelete={() => handleDeleteCategory(category.id!)}
												onEdit={() => handleEditCategory(category)}
											/>
										</motion.div>
									))}
								</AnimatePresence>
							</div>
						),
					},
				]}
			/>
		</motion.div>
	)
}
