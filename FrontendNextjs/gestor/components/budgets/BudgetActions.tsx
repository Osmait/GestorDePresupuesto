'use client'

import { Button } from '@/components/ui/button'
import { PlusCircle } from 'lucide-react'
import { useBudgetContext } from './BudgetContext'
import { useTranslations } from 'next-intl'

export function BudgetActions() {
    const t = useTranslations('budgets')
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
                {t('addBudget')}
            </Button>
        </div>
    )
}

