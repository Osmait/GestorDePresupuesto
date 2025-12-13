'use client'

import { useTransactions, useCategories, useAccounts } from '@/hooks/useRepositories'
import { motion } from 'framer-motion'
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

    const { categories, isLoading: isLoadingCat } = useCategories()
    const { isLoading: isLoadingAcc } = useAccounts()
    const searchParams = useSearchParams()

    const incomeTransactions = transactions.filter(t => t.type_transation === TypeTransaction.INCOME)
    const expenseTransactions = transactions.filter(t => t.type_transation === TypeTransaction.BILL)

    const shownTransactions = Array.isArray(transactions) ? transactions.slice().sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) : []

    const renderTransactionList = (transactionList: Transaction[]) => (
        <div className="space-y-4">
            {transactionList.map((transaction) => {
                const category = categories.find(c => c.id === transaction.category_id)
                return (
                    <TransactionItem
                        key={transaction.id}
                        transaction={transaction}
                        category={category}
                        onTransactionDeleted={async () => {
                            await deleteTransaction(transaction.id!)
                            reloadCurrentView() // Use function from Context
                        }}
                    />
                )
            })}
        </div>
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
