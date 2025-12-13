'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Palette, PlusCircle } from 'lucide-react'
import { CategoryFormModal } from './CategoryFormModal' // We need to move or export this
import { useCategories } from '@/hooks/useRepositories'

// Moving CategoryFormModal here or importing it? 
// The original file had CategoryFormModal defined inside page.tsx. 
// I should probably extract CategoryFormModal to its own file first or include it here if small.
// It was relatively large (form, logic). I'll execute a separate write for CategoryFormModal.tsx for cleanliness.

export function CategoryActions() {
    const [modalOpen, setModalOpen] = useState(false)
    const { createCategory } = useCategories()

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
