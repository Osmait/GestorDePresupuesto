'use client'

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

    const incomeTransactions = transactions.filter(t => t.type_transation === TypeTransaction.INCOME)
    const expenseTransactions = transactions.filter(t => t.type_transation === TypeTransaction.BILL)

    const shownTransactions = Array.isArray(transactions) ? transactions.slice().sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) : []

    const renderTransactionList = (transactionList: Transaction[]) => (
        <ul className="space-y-4">
            <AnimatePresence mode="popLayout" initial={false}>
                {transactionList.map((transaction) => {
                    const category = categories.find(c => c.id === transaction.category_id)
                    return (
                        <motion.li
                            key={transaction.id}
                            initial={{ opacity: 0, height: 0, x: -20 }}
                            animate={{ opacity: 1, height: 'auto', x: 0 }}
                            exit={{ opacity: 0, height: 0, x: 20 }}
                            transition={{ duration: 0.5, ease: "easeOut" }}
                            className="list-none"
                        >
                            <TransactionItem
                                transaction={transaction}
                                category={category}
                                onTransactionDeleted={async () => {
                                    await deleteTransaction(transaction.id!)
                                    // Local optimistic delete could be added here too
                                    reloadCurrentView()
                                }}
                            />
                        </motion.li>
                    )
                })}
            </AnimatePresence>
        </ul>
    )

    const tabsConfig = [
        { value: 'all', label: 'Todas', icon: <CreditCard className="h-4 w-4" />, transactionList: shownTransactions },
        { value: 'income', label: 'Ingresos', icon: <TrendingUp className="h-4 w-4" />, transactionList: incomeTransactions },
        { value: 'expense', label: 'Gastos', icon: <TrendingDown className="h-4 w-4" />, transactionList: expenseTransactions }
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

            {pagination && (
                <div className="mb-4 flex justify-between items-center text-sm text-muted-foreground">
                    <span>
                        Mostrando {transactions.length} de {pagination.total_records} transacciones
                        {pagination.total_pages > 1 && ` (Página ${pagination.current_page} de ${pagination.total_pages})`}
                    </span>
                    {(searchParams.toString().length > 0) && (
                        <Button variant="link" size="sm" onClick={clearFilters}>
                            Ver todas las transacciones
                        </Button>
                    )}
                </div>
            )}

            <AnimatedTabs
                defaultValue="all"
                tabs={tabsConfig.map(tab => ({
                    value: tab.value,
                    label: tab.label,
                    icon: tab.icon,
                    content: renderTransactionList(tab.transactionList)
                }))}
            />
        </motion.div>
    )
}
