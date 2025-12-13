'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Palette, PlusCircle } from 'lucide-react'
import { CategoryFormModal } from './CategoryFormModal' // We need to move or export this
import { useCategoryContext } from '@/components/categories/CategoryContext'

// ... imports ...

export function CategoryActions() {
    const [modalOpen, setModalOpen] = useState(false)
    const { createCategory } = useCategoryContext()

    return (
        <div className="flex items-center gap-3">
            <Button variant="outline" className="border-border/50">
                <Palette className="h-4 w-4 mr-2" />
                Colores
            </Button>
            <Button
                className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
                onClick={() => setModalOpen(true)}
            >
                <PlusCircle className="h-4 w-4 mr-2" />
                Nueva Categoría
            </Button>
            <CategoryFormModal
                open={modalOpen}
                setOpen={setModalOpen}
                onCreateCategory={createCategory}
            />
        </div>
    )
}
