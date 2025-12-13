'use client'

import { createContext, useContext, ReactNode } from 'react'
import { useCategories } from '@/hooks/useRepositories'
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
    const {
        categories,
        isLoading,
        error,
        createCategory,
        deleteCategory,
        refetch
    } = useCategories()

    return (
        <CategoryContext.Provider value={{
            categories,
            isLoading,
            error,
            createCategory,
            deleteCategory,
            refetch
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
