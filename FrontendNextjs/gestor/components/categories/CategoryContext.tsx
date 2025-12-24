'use client'

import { createContext, useContext, ReactNode, useState } from 'react'
import { useGetCategories, useCreateCategoryMutation, useDeleteCategoryMutation, useUpdateCategoryMutation } from '@/hooks/queries/useCategoriesQuery'
import { Category } from '@/types/category'

interface CategoryContextType {
    categories: Category[]
    isLoading: boolean
    error: string | null
    createCategory: (_name: string, _icon: string, _color: string) => Promise<void>
    updateCategory: (_id: string, _name: string, _icon: string, _color: string) => Promise<void>
    deleteCategory: (_id: string) => Promise<void>
    refetch: () => Promise<void>
    editingCategory: Category | null
    setEditingCategory: (_category: Category | null) => void
    isModalOpen: boolean
    setModalOpen: (_open: boolean) => void
}

const CategoryContext = createContext<CategoryContextType | undefined>(undefined)

export function CategoryProvider({ children }: { children: ReactNode }) {
    // React Query Hooks
    const { data: categories = [], isLoading, error: queryError, refetch } = useGetCategories()
    const createMutation = useCreateCategoryMutation()
    const deleteMutation = useDeleteCategoryMutation()
    const [editingCategory, setEditingCategory] = useState<Category | null>(null)
    const [isModalOpen, setModalOpen] = useState(false)
    const updateMutation = useUpdateCategoryMutation()

    const error = queryError ? (queryError as Error).message : null

    const createCategory = async (name: string, icon: string, color: string) => {
        await createMutation.mutateAsync({ name, icon, color })
    }

    const updateCategory = async (id: string, name: string, icon: string, color: string) => {
        await updateMutation.mutateAsync({ id, name, icon, color })
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
            updateCategory,
            deleteCategory,
            refetch: async () => { await refetch() },
            editingCategory,
            setEditingCategory,
            isModalOpen,
            setModalOpen
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
