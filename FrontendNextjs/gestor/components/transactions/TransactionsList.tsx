'use client'

import { useEffect, useMemo, useState } from 'react'
import { useGetAccounts } from '@/hooks/queries/useAccountsQuery'
import { useGetCategories } from '@/hooks/queries/useCategoriesQuery'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { CreditCard, TrendingUp, TrendingDown } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AnimatedTabs } from '@/components/common/animated-tabs'
import TransactionItem from '@/components/transactions/TransactionItem'
import TransactionSummaryCard from '@/components/transactions/TransactionSummaryCard'
import { Transaction, TypeTransaction } from '@/types/transaction'
import { TransactionsPageSkeleton } from '@/components/transactions/TransactionsPageSkeleton'
import { useSearchParams } from 'next/navigation'
import { useTransactionContext } from './TransactionContext'
import { TransactionSort } from './TransactionSort'
import { useTranslations } from 'next-intl'

export default function TransactionsList() {
    const t = useTranslations('transactions')
    const tCommon = useTranslations('common')
    const {
        transactions,
        pagination,
        summary,
        isLoading: isLoadingTx,
        deleteTransaction,
        clearFilters,
        reloadCurrentView
    } = useTransactionContext()

    const { data: categories = [], isLoading: isLoadingCat } = useGetCategories()
    const { data: accounts = [], isLoading: isLoadingAcc } = useGetAccounts()
    const searchParams = useSearchParams()
    const highlightedTransactionId = searchParams.get('highlight') || ''
    const shouldOpenDetails = searchParams.get('open') === 'details'

    const [currentFilter, setCurrentFilter] = useState('all')
    const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null)

    const incomeTransactions = useMemo(
        () => transactions.filter(t => t.type_transation === TypeTransaction.INCOME),
        [transactions]
    )
    const expenseTransactions = useMemo(
        () => transactions.filter((t) =>
            t.type_transation === TypeTransaction.BILL ||
            t.type_transation === TypeTransaction.LOAN_DISBURSEMENT ||
            t.type_transation === TypeTransaction.INVESTMENT_PURCHASE ||
            t.type_transation === TypeTransaction.INVESTMENT_FUNDING
        ),
        [transactions]
    )

    const filteredTransactions = useMemo(() => {
        switch (currentFilter) {
            case 'income': return incomeTransactions
            case 'expense': return expenseTransactions
            default: return transactions
        }
    }, [currentFilter, transactions, incomeTransactions, expenseTransactions])

    const renderTransactionList = (transactionList: Transaction[]) => (
        <ul className="space-y-4 min-h-[50vh]">
            {/* AnimatePresence mode="sync" is cheaper than "popLayout":
                "popLayout" measures every sibling's layout on each change (O(n)),
                while "sync" only animates the entering/exiting element.
                The `layout` prop is intentionally omitted for the same reason. */}
            <AnimatePresence mode="sync" initial={false}>
                {transactionList.map((transaction) => {
                    const category = categories.find(c => c.id === transaction.category_id)
                    return (
                        <motion.li
                            key={transaction.id}
                            id={`transaction-item-${transaction.id}`}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.2, ease: "easeOut" }}
                            className={highlightedTransactionId === transaction.id ? 'list-none rounded-xl ring-2 ring-primary/70 ring-offset-2 ring-offset-background' : 'list-none'}
                        >
                            <TransactionItem
                                transaction={transaction}
                                category={category}
                                onOpenDetails={(item) => setSelectedTransaction(item)}
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
                    {t('noTransactions')}
                </motion.div>
            )}
        </ul>
    )

    const tabsConfig = [
        { value: 'all', label: t('all'), icon: <CreditCard className="h-4 w-4" />, content: <></> },
        { value: 'income', label: t('income'), icon: <TrendingUp className="h-4 w-4" />, content: <></> },
        { value: 'expense', label: t('expense'), icon: <TrendingDown className="h-4 w-4" />, content: <></> }
    ]

    useEffect(() => {
        if (!highlightedTransactionId) return
        const element = document.getElementById(`transaction-item-${highlightedTransactionId}`)
        if (!element) return
        element.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, [highlightedTransactionId, transactions])

    useEffect(() => {
        if (!shouldOpenDetails || !highlightedTransactionId || selectedTransaction) return
        const match = transactions.find((item) => item.id === highlightedTransactionId)
        if (match) {
            setSelectedTransaction(match)
        }
    }, [shouldOpenDetails, highlightedTransactionId, selectedTransaction, transactions])

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
                <TransactionSummaryCard transactions={transactions} summary={summary} />
            </div>

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                {pagination && (
                    <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                        <span>
                            {t('showing')} {transactions.length} {t('of')} {pagination.total_records} {t('transactionsCount')}
                            {pagination.total_pages > 1 && ` (${t('page')} ${pagination.current_page} ${t('of')} ${pagination.total_pages})`}
                        </span>
                        {(searchParams.toString().length > 0) && (
                            <Button variant="link" size="sm" onClick={clearFilters} className="h-auto p-0 ml-2">
                                {tCommon('actions.viewAll')}
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

                {renderTransactionList(filteredTransactions)}
            </div>

            <Dialog open={Boolean(selectedTransaction)} onOpenChange={(open) => !open && setSelectedTransaction(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{selectedTransaction?.name}</DialogTitle>
                        <DialogDescription>{selectedTransaction?.description || t('description')}</DialogDescription>
                    </DialogHeader>
                    {selectedTransaction && (
                        <div className="space-y-3 text-sm">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <p className="text-xs text-muted-foreground">{t('amount')}</p>
                                    <p className="font-semibold">{selectedTransaction.amount >= 0 ? '+' : '-'}${Math.abs(selectedTransaction.amount).toLocaleString()}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground">{t('type')}</p>
                                    <p className="font-semibold">{selectedTransaction.type_transation}</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <p className="text-xs text-muted-foreground">{t('account')}</p>
                                    <p className="font-semibold">{accounts.find((acc) => acc.id === selectedTransaction.account_id)?.name || selectedTransaction.account_id}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground">{t('category')}</p>
                                    <p className="font-semibold">{categories.find((cat) => cat.id === selectedTransaction.category_id)?.name || '-'}</p>
                                </div>
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">{t('date')}</p>
                                <p className="font-semibold">{new Date(selectedTransaction.created_at).toLocaleString()}</p>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </motion.div>
    )
}
