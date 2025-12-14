'use client'

import { createContext, useContext, ReactNode } from 'react'
import { useGetCategories, useCreateCategoryMutation, useDeleteCategoryMutation } from '@/hooks/queries/useCategoriesQuery'
import { Category } from '@/types/category'

interface CategoryContextType {
    categories: Category[]
    isLoading: boolean
    error: string | null
    createCategory: (name: string, icon: string, color: string) => Promise<void>
    deleteCategory: (id: string) => Promise<void>
    refetch: () => Promise<void>
}

const CategoryContext = createContext<CategoryContextType | undefined>(undefined)

export function CategoryProvider({ children }: { children: ReactNode }) {
    // React Query Hooks
    const { data: categories = [], isLoading, error: queryError, refetch } = useGetCategories()
    const createMutation = useCreateCategoryMutation()
    const deleteMutation = useDeleteCategoryMutation()

    const error = queryError ? (queryError as Error).message : null

    const createCategory = async (name: string, icon: string, color: string) => {
        await createMutation.mutateAsync({ name, icon, color })
    }

    const deleteCategory = async (id: string) => {
        await deleteMutation.mutateAsync(id)
    }

    return (
        <CategoryContext.Provider value={{
            categories,
            isLoading,
            error,
            createCategory,
            deleteCategory,
            refetch: async () => { await refetch() }
        }}>
            {children}
        </CategoryContext.Provider>
    )
}

export function useCategoryContext() {
    const context = useContext(CategoryContext)
    if (!context) {
        throw new Error('useCategoryContext must be used within a CategoryProvider')
    }
    return context
}
