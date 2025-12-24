'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Filter, PlusCircle } from 'lucide-react'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { CalendarDateRangePicker } from '@/components/date-range-picker'
import TransactionFormModal from '@/components/transactions/TransactionFormModal'
import { useTransactionContext } from './TransactionContext'
import { useGetAccounts } from '@/hooks/queries/useAccountsQuery'
import { useGetCategories } from '@/hooks/queries/useCategoriesQuery'

export function TransactionActions() {
    const [drawerOpen, setDrawerOpen] = useState(false)
    const formRef = useRef<{ reset: () => void } | null>(null)

    const { filters, setFilters, applyFilters, clearFilters, reloadCurrentView, createTransaction, addTransaction, isLoading, error, isModalOpen, setModalOpen, setEditingTransaction } = useTransactionContext()
    const { data: accounts = [] } = useGetAccounts()
    const { data: categories = [] } = useGetCategories()

    // handleApplyFilters removed as it is now automatic

    return (
        <div className="flex items-center gap-3">
            <Button variant="outline" className="border-border/50" onClick={() => setDrawerOpen(true)}>
                <Filter className="h-4 w-4 mr-2" aria-hidden="true" />
                Filtrar
            </Button>
            <Button
                className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
                onClick={() => {
                    setEditingTransaction(null)
                    setModalOpen(true)
                }}
            >
                <PlusCircle className="h-4 w-4 mr-2" aria-hidden="true" />
                Nueva Transacción
            </Button>

            <TransactionFormModal
                open={isModalOpen}
                setOpen={(open: boolean) => {
                    setModalOpen(open)
                    if (!open) {
                        formRef.current?.reset()
                    }
                }}
                createTransaction={async (...args) => {
                    // Optimistic Close
                    setModalOpen(false)

                    try {
                        // Construct Optimistic Transaction
                        const [name, description, amount, type_transation, account_id, category_id] = args;
                        const optimisticTx = {
                            id: `temp-${Date.now()}`,
                            name,
                            description,
                            amount,
                            type_transation,
                            account_id,
                            category_id,
                            created_at: new Date().toISOString(), // Use string to match typical API response or Date depending on type
                            user_id: 'current-user', // Placeholder
                            updated_at: new Date().toISOString()
                        };

                        // Add to list immediately (Context)
                        // @ts-ignore
                        addTransaction(optimisticTx);

                        // Perform actual save
                        // @ts-ignore
                        await createTransaction(...args)

                        formRef.current?.reset()
                        // Optionally reload in background without UI loader if needed
                        // reloadCurrentView() // Disabled to prevent full list refresh
                    } catch (error) {
                        console.error("Failed to create transaction:", error)
                    }
                }}
                isLoading={isLoading}
                error={error}
                formRef={formRef}
            />

            <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
                <DrawerContent className="w-full max-w-sm ml-auto h-full">
                    <DrawerHeader>
                        <DrawerTitle>Filtrar Transacciones</DrawerTitle>
                    </DrawerHeader>
                    <div className="p-4 space-y-4 overflow-y-auto">
                        <CalendarDateRangePicker value={filters.dateRange} onChange={dateRange => {
                            if (dateRange && typeof dateRange === 'object' && 'from' in dateRange && 'to' in dateRange) {
                                setFilters(f => ({ ...f, dateRange }))
                            }
                        }} />
                        <div>
                            <label className="block mb-1 text-sm">Tipo</label>
                            <Select value={filters.type} onValueChange={v => setFilters(f => ({ ...f, type: v }))}>
                                <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todos</SelectItem>
                                    <SelectItem value="INCOME">Ingreso</SelectItem>
                                    <SelectItem value="BILL">Gasto</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <label className="block mb-1 text-sm">Cuenta</label>
                            <Select value={filters.account} onValueChange={v => setFilters(f => ({ ...f, account: v }))}>
                                <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todas</SelectItem>
                                    {accounts.map(acc => <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <label className="block mb-1 text-sm">Categoría</label>
                            <Select value={filters.category} onValueChange={v => setFilters(f => ({ ...f, category: v }))}>
                                <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todas</SelectItem>
                                    {categories.map(cat => <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex gap-2">
                            <div className="flex-1">
                                <label className="block mb-1 text-sm">Monto mínimo</label>
                                <Input type="number" value={filters.minAmount} onChange={e => setFilters(f => ({ ...f, minAmount: e.target.value }))} placeholder="0" min={0} />
                            </div>
                            <div className="flex-1">
                                <label className="block mb-1 text-sm">Monto máximo</label>
                                <Input type="number" value={filters.maxAmount} onChange={e => setFilters(f => ({ ...f, maxAmount: e.target.value }))} placeholder="99999" min={0} />
                            </div>
                        </div>
                        <div>
                            <label className="block mb-1 text-sm">Buscar</label>
                            <Input type="text" value={filters.search} onChange={e => setFilters(f => ({ ...f, search: e.target.value }))} placeholder="Buscar por descripción..." />
                        </div>
                        <div className="flex flex-col gap-2 pt-4">
                            <Button type="button" variant="outline" onClick={() => clearFilters()}>Limpiar Filtros</Button>
                        </div>
                    </div>
                </DrawerContent>
            </Drawer>
        </div>
    )
}
