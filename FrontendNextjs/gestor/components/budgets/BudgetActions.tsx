'use client'

import { Button } from '@/components/ui/button'
import { PlusCircle } from 'lucide-react'
import { useBudgetContext } from './BudgetContext'

export function BudgetActions() {
    const { setModalOpen, setEditingBudget } = useBudgetContext()

    const handleCreate = () => {
        setEditingBudget(null)
        setModalOpen(true)
    }

    return (
        <div className="flex items-center gap-3">
            <Button
                className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
                onClick={handleCreate}
            >
                <PlusCircle className="h-4 w-4 mr-2" />
                Nuevo Presupuesto
            </Button>
            {/* Modal is now rendered in BudgetList or we can render it here too, but better if centralized. 
                However, BudgetList renders it. We don't need to render it here if BudgetList is always present.
                If this button is outside BudgetList (which it is in page.tsx), we rely on Context.
            */}
        </div>
    )
}
