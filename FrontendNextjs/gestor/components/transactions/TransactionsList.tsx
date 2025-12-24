'use client'

import { useState } from 'react'
import { useGetAccounts } from '@/hooks/queries/useAccountsQuery'
import { useGetCategories } from '@/hooks/queries/useCategoriesQuery'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { CreditCard, TrendingUp, TrendingDown } from 'lucide-react'
import { AnimatedTabs } from '@/components/common/animated-tabs'
import TransactionItem from '@/components/transactions/TransactionItem'
import TransactionSummaryCard from '@/components/transactions/TransactionSummaryCard'
import { Transaction, TypeTransaction } from '@/types/transaction'
import { TransactionsPageSkeleton } from '@/components/transactions/TransactionsPageSkeleton'
import { useSearchParams } from 'next/navigation'
import { useTransactionContext } from './TransactionContext'
import { TransactionSort } from './TransactionSort'

export default function TransactionsList() {
    const {
        transactions,
        pagination,
        isLoading: isLoadingTx,
        deleteTransaction,
        clearFilters,
        reloadCurrentView
    } = useTransactionContext()

    const { data: categories = [], isLoading: isLoadingCat } = useGetCategories()
    const { isLoading: isLoadingAcc } = useGetAccounts()
    const searchParams = useSearchParams()

    const [currentFilter, setCurrentFilter] = useState('all')

    const incomeTransactions = transactions.filter(t => t.type_transation === TypeTransaction.INCOME)
    const expenseTransactions = transactions.filter(t => t.type_transation === TypeTransaction.BILL)
    // Removed client-side sorting. Transactions are now sorted by the backend.

    const getFilteredTransactions = () => {
        switch (currentFilter) {
            case 'income': return incomeTransactions
            case 'expense': return expenseTransactions
            default: return transactions // Use server-sorted/filtered transactions
        }
    }

    const renderTransactionList = (transactionList: Transaction[]) => (
        <ul className="space-y-4 min-h-[50vh]">
            <AnimatePresence mode="popLayout" initial={false}>
                {transactionList.map((transaction) => {
                    const category = categories.find(c => c.id === transaction.category_id)
                    return (
                        <motion.li
                            key={transaction.id}
                            layout // Add layout prop for smooth reordering/filtering
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.3, ease: "easeInOut" }}
                            className="list-none"
                        >
                            <TransactionItem
                                transaction={transaction}
                                category={category}
                                onTransactionDeleted={async () => {
                                    await deleteTransaction(transaction.id!)
                                    reloadCurrentView()
                                }}
                            />
                        </motion.li>
                    )
                })}
            </AnimatePresence>
            {transactionList.length === 0 && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center py-10 text-muted-foreground"
                >
                    No se encontraron transacciones
                </motion.div>
            )}
        </ul>
    )

    const tabsConfig = [
        { value: 'all', label: 'Todas', icon: <CreditCard className="h-4 w-4" />, content: <></> },
        { value: 'income', label: 'Ingresos', icon: <TrendingUp className="h-4 w-4" />, content: <></> },
        { value: 'expense', label: 'Gastos', icon: <TrendingDown className="h-4 w-4" />, content: <></> }
    ]

    // Loading State
    if (isLoadingTx || isLoadingCat || isLoadingAcc) {
        return <TransactionsPageSkeleton />
    }

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
        >
            <div className="mb-8">
                <TransactionSummaryCard transactions={transactions} />
            </div>

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                {pagination && (
                    <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                        <span>
                            Mostrando {transactions.length} de {pagination.total_records} transacciones
                            {pagination.total_pages > 1 && ` (Página ${pagination.current_page} de ${pagination.total_pages})`}
                        </span>
                        {(searchParams.toString().length > 0) && (
                            <Button variant="link" size="sm" onClick={clearFilters} className="h-auto p-0 ml-2">
                                Ver todas
                            </Button>
                        )}
                    </div>
                )}
                <div className="ml-auto">
                    <TransactionSort />
                </div>
            </div>

            <div className="space-y-6">
                <AnimatedTabs
                    defaultValue="all"
                    onValueChange={setCurrentFilter}
                    tabs={tabsConfig}
                    noContent={true}
                />

                {/* Render content outside of AnimatedTabs to preserve scroll/mount */}
                {renderTransactionList(getFilteredTransactions())}
            </div>
        </motion.div>
    )
}
