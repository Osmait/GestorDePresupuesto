'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { PlusCircle } from 'lucide-react'
import { BudgetFormModal } from './BudgetFormModal'

export function BudgetActions() {
    const [modalOpen, setModalOpen] = useState(false)

    return (
        <div className="flex items-center gap-3">
            <Button
                className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
                onClick={() => setModalOpen(true)}
            >
                <PlusCircle className="h-4 w-4 mr-2" />
                Nuevo Presupuesto
            </Button>
            <BudgetFormModal open={modalOpen} setOpen={setModalOpen} />
        </div>
    )
}
