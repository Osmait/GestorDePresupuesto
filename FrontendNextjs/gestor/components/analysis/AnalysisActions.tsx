'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter, DrawerClose } from '@/components/ui/drawer'
import { useAnalysisContext } from './AnalysisContext'
import { AnalysisFiltersForm } from './AnalysisFilters'
import { useGetCategories } from '@/hooks/queries/useCategoriesQuery'
import { useGetAccounts } from '@/hooks/queries/useAccountsQuery'

const now = new Date()
const defaultMonth = String(now.getMonth() + 1).padStart(2, '0')
const defaultYear = String(now.getFullYear())

export function AnalysisActions() {
    const [drawerOpen, setDrawerOpen] = useState(false)
    const { filters, setFilters } = useAnalysisContext()
    const { data: accounts = [] } = useGetAccounts()
    const { data: categories = [] } = useGetCategories()

    return (
        <div className="flex items-center gap-3">
            <Button variant="outline" className="border-border/50" onClick={() => setDrawerOpen(true)}>
                Filtrar
            </Button>

            <Drawer open={drawerOpen} onOpenChange={setDrawerOpen} side="right">
                <DrawerContent side="right" className="p-6">
                    <DrawerHeader>
                        <DrawerTitle>Filtrar Analíticas</DrawerTitle>
                    </DrawerHeader>
                    <AnalysisFiltersForm
                        filters={filters}
                        setFilters={setFilters}
                        accounts={accounts}
                        categories={categories}
                    />
                    <DrawerFooter>
                        <Button type="button" variant="outline" onClick={() => setFilters({
                            filterMode: 'month',
                            month: defaultMonth,
                            year: defaultYear,
                            dateRange: { from: undefined, to: undefined },
                            account: 'all',
                            category: 'all',
                            type: 'all',
                            minAmount: '',
                            maxAmount: '',
                            search: '',
                        })} className="w-full">Limpiar Filtros</Button>
                        <DrawerClose asChild>
                            <Button type="button" variant="ghost" className="w-full">Cerrar</Button>
                        </DrawerClose>
                    </DrawerFooter>
                </DrawerContent>
            </Drawer>
        </div>
    )
}
