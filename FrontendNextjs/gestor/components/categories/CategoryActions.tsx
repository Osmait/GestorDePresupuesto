'use client'


import { Button } from '@/components/ui/button'
import { PlusCircle } from 'lucide-react'
import { CategoryFormModal } from './CategoryFormModal'
import { useCategoryContext } from '@/components/categories/CategoryContext'
import { useTranslations } from 'next-intl'

export function CategoryActions() {
    const t = useTranslations('categories')
    const { createCategory, setEditingCategory, isModalOpen, setModalOpen } = useCategoryContext()

    return (
        <div className="flex items-center gap-3">

            <Button
                className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
                onClick={() => {
                    setEditingCategory(null)
                    setModalOpen(true)
                }}
            >
                <PlusCircle className="h-4 w-4 mr-2" />
                {t('addCategory')}
            </Button>
            <CategoryFormModal
                open={isModalOpen}
                setOpen={setModalOpen}
                onCreateCategory={createCategory}
            />
        </div>
    )
}

