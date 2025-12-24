'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useGetAllTransactions } from '@/hooks/queries/useTransactionsQuery'
import { useGetCategories, useDeleteCategoryMutation } from '@/hooks/queries/useCategoriesQuery'
import { useCategoryContext } from '@/components/categories/CategoryContext'
import { AnimatedTabs } from '@/components/common/animated-tabs'
import { Tag } from 'lucide-react'
import { Category } from '@/types/category'
import { CategoriesSkeleton } from '@/components/skeletons/categories-skeleton'
import { useTranslations } from 'next-intl'
import { CategoryCard } from './CategoryCard'
import { CategorySummaryCard } from './CategorySummaryCard'


export function CategoryList() {
    const t = useTranslations('categories')
    const { data: categories = [], isLoading: isLoadingCategories } = useGetCategories()
    const { data: transactions = [], isLoading: isLoadingTransactions } = useGetAllTransactions()
    const { setEditingCategory, setModalOpen } = useCategoryContext()

    const deleteCategoryMutation = useDeleteCategoryMutation()

    const isLoading = isLoadingCategories || isLoadingTransactions

    const handleDeleteCategory = async (categoryId: string) => {
        await deleteCategoryMutation.mutateAsync(categoryId)
    }

    const handleEditCategory = (category: Category) => {
        setEditingCategory(category)
        setModalOpen(true)
    }

    if (isLoading) {
        return <CategoriesSkeleton />
    }

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
        >
            <div className="mb-8">
                <CategorySummaryCard categories={categories} transactions={transactions} />
            </div>

            <AnimatedTabs
                defaultValue="all"
                tabs={[
                    {
                        value: 'all',
                        label: t('all'),
                        icon: <Tag className="h-4 w-4" />,
                        content: (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                <AnimatePresence mode="popLayout" initial={false}>
                                    {categories.map((category) => (
                                        <motion.div
                                            key={category.id}
                                            initial={{ opacity: 0, y: 15 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, scale: 0.95 }}
                                            transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
                                        >
                                            <CategoryCard
                                                category={category}
                                                transactions={transactions}
                                                onDelete={() => handleDeleteCategory(category.id!)}
                                                onEdit={() => handleEditCategory(category)}
                                            />
                                        </motion.div>
                                    ))}
                                </AnimatePresence>
                            </div>
                        )
                    },
                ]}
            />
        </motion.div>
    )
}
