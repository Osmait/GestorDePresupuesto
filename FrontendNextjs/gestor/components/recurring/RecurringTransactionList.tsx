'use client'

import { format } from 'date-fns'
import { MoreHorizontal, CalendarClock, ArrowUpCircle, ArrowDownCircle, Trash, Edit } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useRecurringTransactionsQuery, useDeleteRecurringTransactionMutation } from '@/hooks/queries/useRecurringTransactionsQuery'
import { useRecurringTransactionContext } from './RecurringTransactionContext'
import { Skeleton } from '@/components/ui/skeleton'

export function RecurringTransactionList() {
    const { data: transactions, isLoading } = useRecurringTransactionsQuery()
    const deleteMutation = useDeleteRecurringTransactionMutation()
    const { setEditingTransaction, setModalOpen } = useRecurringTransactionContext()

    if (isLoading) {
        return <div className="space-y-4">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
    }

    if (!transactions || transactions.length === 0) {
        return (
            <Card className="text-center py-12">
                <CardContent>
                    <CalendarClock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold">No hay transacciones recurrentes</h3>
                    <p className="text-muted-foreground">Configura tus gastos o ingresos fijos para que se generen automáticamente.</p>
                </CardContent>
            </Card>
        )
    }

    const handleDelete = (id: string) => {
        if (confirm('¿Estás seguro de eliminar esta transacción recurrente?')) {
            deleteMutation.mutate(id)
        }
    }

    const handleEdit = (item: any) => {
        setEditingTransaction(item)
        setModalOpen(true)
    }

    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {transactions.map((item) => (
                <Card key={item.id} className="hover:shadow-md transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            {item.name}
                        </CardTitle>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0">
                                    <span className="sr-only">Open menu</span>
                                    <MoreHorizontal className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                                <DropdownMenuItem onClick={() => handleEdit(item)}>
                                    <Edit className="mr-2 h-4 w-4" /> Editar
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => handleDelete(item.id)} className="text-destructive">
                                    <Trash className="mr-2 h-4 w-4" /> Eliminar
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center space-x-2">
                                {item.type === 'income' ? (
                                    <ArrowUpCircle className="h-5 w-5 text-green-500" />
                                ) : (
                                    <ArrowDownCircle className="h-5 w-5 text-red-500" />
                                )}
                                <span className="text-2xl font-bold">
                                    ${item.amount.toLocaleString()}
                                </span>
                            </div>
                        </div>
                        <div className="flex justify-between items-center text-xs text-muted-foreground">
                            <div className="flex items-center">
                                <CalendarClock className="mr-1 h-3 w-3" />
                                Día {item.day_of_month} de cada mes
                            </div>
                            {item.last_execution_date && (
                                <span>
                                    Última ej: {format(new Date(item.last_execution_date), 'dd/MM/yyyy')}
                                </span>
                            )}
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    )
}
