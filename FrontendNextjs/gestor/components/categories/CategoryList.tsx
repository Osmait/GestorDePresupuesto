'use client'

import { Plus, Tag } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useEffect } from 'react'
import { useCategoryContext } from '@/components/categories/CategoryContext'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { CategoriesSkeleton } from '@/components/skeletons/categories-skeleton'
import { Button } from '@/components/ui/button'
import { useGetDashboardSummary } from '@/hooks/queries/useAnalyticsQuery'
import { useDeleteCategoryMutation, useGetCategories } from '@/hooks/queries/useCategoriesQuery'
import { cn } from '@/lib/utils'
import { Category } from '@/types/category'
import { CategoryCard } from './CategoryCard'
import { CategorySummaryCard } from './CategorySummaryCard'

export function CategoryList() {
	const t = useTranslations('categories')
	const {
		data: categoriesData,
		isLoading: isLoadingCategories,
		isError: isCategoriesError,
		refetch: refetchCategories,
	} = useGetCategories()
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

	const handleCreateCategory = () => {
		setEditingCategory(null)
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

	// A failed refetch keeps the cached list; only an empty failed load is an error page.
	if (isCategoriesError && categories.length === 0) {
		return <ErrorState onRetry={() => void refetchCategories()} />
	}

	if (categories.length === 0) {
		return (
			<EmptyState
				icon={Tag}
				title={t('emptyTitle')}
				description={t('emptyDescription')}
				action={
					<Button onClick={handleCreateCategory}>
						<Plus className='mr-2 h-4 w-4' aria-hidden='true' />
						{t('addCategory')}
					</Button>
				}
			/>
		)
	}

	return (
		<div className='space-y-6'>
			<CategorySummaryCard categories={categories} categoryExpenses={categoryExpenses} />

			<div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3'>
				{categories.map((category) => (
					<div
						key={category.id}
						id={`category-card-${category.id}`}
						className={cn(
							'rounded-lg',
							selectedCategoryId === category.id && 'ring-2 ring-primary/70 ring-offset-2 ring-offset-background',
						)}
					>
						<CategoryCard
							category={category}
							stats={categoryStatsById.get(category.id || '')}
							onDelete={() => handleDeleteCategory(category.id!)}
							onEdit={() => handleEditCategory(category)}
						/>
					</div>
				))}
			</div>
		</div>
	)
}
