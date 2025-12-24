"use client"

import { useParams } from 'next/navigation'
import { useGetAccount } from '@/hooks/queries/useAccountsQuery'
import { useGetTransactions } from '@/hooks/queries/useTransactionsQuery'
import { AccountAnalytics } from '@/components/accounts/AccountAnalytics'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertCircle, ArrowLeft } from 'lucide-react' // Using standard Lucide icons
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import TransactionItem from '@/components/transactions/TransactionItem'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useGetCategories } from '@/hooks/queries/useCategoriesQuery'

export default function AccountDetailsPage() {
    const params = useParams()
    const id = params.id as string

    const { data: account, isLoading: isLoadingAccount, isError } = useGetAccount(id)

    // Fetch all transactions, then filter by account. 
    // Ideally use backend filtering if API supports strict filtering by props not just URL.
    // The current useGetTransactions takes filters object.
    const { data: transactionData, isLoading: isLoadingTx } = useGetTransactions({
        account_id: id,
        limit: 100 // Get last 100 transactions for this account
    })

    const { data: categories = [] } = useGetCategories()

    const transactions = transactionData?.transactions || []

    if (isLoadingAccount || isLoadingTx) {
        return (
            <div className="container mx-auto px-4 py-8 space-y-8">
                <Skeleton className="h-12 w-1/3" />
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <Skeleton className="h-32" />
                    <Skeleton className="h-32" />
                    <Skeleton className="h-32 col-span-2" />
                </div>
                <Skeleton className="h-[400px]" />
            </div>
        )
    }

    if (isError || !account) {
        return (
            <div className="container mx-auto px-4 py-8 text-center flex flex-col items-center justify-center min-h-[50vh]">
                <AlertCircle className="h-12 w-12 text-destructive mb-4" />
                <h2 className="text-2xl font-bold mb-2">Cuenta no encontrada</h2>
                <p className="text-muted-foreground mb-4">No pudimos encontrar la cuenta que estás buscando.</p>
                <Link href="/app/accounts">
                    <Button>Volver a Cuentas</Button>
                </Link>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 dark:from-background dark:via-background dark:to-muted/20">
            <div className="container mx-auto px-4 py-8">
                <div className="mb-6">
                    <Link href="/app/accounts" className="text-sm text-muted-foreground hover:text-foreground flex items-center mb-2">
                        <ArrowLeft className="mr-2 h-4 w-4" /> Volver a Cuentas
                    </Link>
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-4xl font-bold tracking-tight text-foreground">{account.name}</h1>
                            <p className="text-xl text-muted-foreground mt-1">{account.bank}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-sm text-muted-foreground">Saldo Actual</p>
                            <h2 className="text-3xl font-bold text-primary">${(account.current_balance ?? account.initial_balance).toLocaleString()}</h2>
                        </div>
                    </div>
                </div>

                <AccountAnalytics
                    transactions={transactions}
                    categories={categories}
                    currentBalance={account.current_balance ?? account.initial_balance}
                />

                <div className="grid gap-6 md:grid-cols-3">
                    <div className="md:col-span-2">
                        <Card>
                            <CardHeader>
                                <CardTitle>Últimas Transacciones</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {transactions.length > 0 ? (
                                    <ul className="space-y-4">
                                        {transactions.map((tx) => {
                                            const category = categories.find(c => c.id === tx.category_id)
                                            return (
                                                <li key={tx.id}>
                                                    <TransactionItem
                                                        transaction={tx}
                                                        category={category}
                                                        onTransactionDeleted={async () => {
                                                            // Optional: invalidate queries
                                                        }}
                                                    />
                                                </li>
                                            )
                                        })}
                                    </ul>
                                ) : (
                                    <div className="text-center py-8 text-muted-foreground">
                                        No hay transacciones registradas en esta cuenta exceptuando el saldo inicial.
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    <div>
                        {/* Side Info / Categories Breakdown could go here */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Detalles</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground">Tipo de Cuenta</p>
                                    <p className="font-medium">Ahorros / Corriente</p>
                                </div>
                                <div className="pt-4 border-t">
                                    <p className="text-sm font-medium text-muted-foreground">Moneda</p>
                                    <p className="font-medium">USD ($)</p>
                                </div>
                                <div className="pt-4 border-t">
                                    <p className="text-sm font-medium text-muted-foreground">Creada el</p>
                                    <p className="font-medium">{new Date().toLocaleDateString()}</p>
                                    {/* The account object might not store createdAt, using placeholder or checking type */}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    )
}
