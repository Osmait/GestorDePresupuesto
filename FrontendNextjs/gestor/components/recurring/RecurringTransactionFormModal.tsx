'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogClose
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Loader2, PlusCircle, AlertCircle, Edit } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useGetCategories } from '@/hooks/queries/useCategoriesQuery'
import { useGetAccounts } from '@/hooks/queries/useAccountsQuery'
import { useRecurringTransactionContext } from './RecurringTransactionContext'
import { useCreateRecurringTransactionMutation, useUpdateRecurringTransactionMutation } from '@/hooks/queries/useRecurringTransactionsQuery'
import { useEffect } from 'react'

const recurringSchema = z.object({
    name: z.string().min(1, 'El nombre es requerido'),
    description: z.string().optional(),
    amount: z.coerce.number().min(0.01, 'El monto debe ser mayor a 0'),
    type: z.enum(['income', 'bill'], { required_error: 'Selecciona un tipo' }),
    account_id: z.string().min(1, 'Selecciona una cuenta'),
    category_id: z.string().min(1, 'Selecciona una categoría'),
    day_of_month: z.coerce.number().min(1).max(31),
})

type RecurringFormValues = z.infer<typeof recurringSchema>

export function RecurringTransactionFormModal() {
    const { isModalOpen, setModalOpen, editingTransaction, setEditingTransaction } = useRecurringTransactionContext()
    const { data: categories = [] } = useGetCategories()
    const { data: accounts = [] } = useGetAccounts()

    const createMutation = useCreateRecurringTransactionMutation()
    const updateMutation = useUpdateRecurringTransactionMutation()

    const isEditing = !!editingTransaction
    const isLoading = createMutation.isPending || updateMutation.isPending
    const error = createMutation.error || updateMutation.error

    const form = useForm<RecurringFormValues>({
        resolver: zodResolver(recurringSchema),
        defaultValues: {
            name: '',
            description: '',
            amount: 0,
            type: 'bill',
            account_id: '',
            category_id: '',
            day_of_month: 1,
        }
    })

    useEffect(() => {
        if (editingTransaction) {
            form.reset({
                name: editingTransaction.name,
                description: editingTransaction.description || '',
                amount: editingTransaction.amount,
                type: editingTransaction.type,
                account_id: editingTransaction.account_id,
                category_id: editingTransaction.category_id,
                day_of_month: editingTransaction.day_of_month,
            })
        } else {
            form.reset({
                name: '',
                description: '',
                amount: 0,
                type: 'bill',
                account_id: '',
                category_id: '',
                day_of_month: 1,
            })
        }
    }, [editingTransaction, form])

    async function onSubmit(values: RecurringFormValues) {
        try {
            if (isEditing && editingTransaction) {
                await updateMutation.mutateAsync({
                    id: editingTransaction.id,
                    data: { ...values, description: values.description || '' }
                })
            } else {
                await createMutation.mutateAsync({ ...values, description: values.description || '' })
            }
            handleOpenChange(false)
        } catch (e) {
            console.error(e)
        }
    }

    const handleOpenChange = (open: boolean) => {
        setModalOpen(open)
        if (!open) {
            setEditingTransaction(null)
            form.reset()
        }
    }

    return (
        <Dialog open={isModalOpen} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>{isEditing ? 'Editar Recurrente' : 'Nueva Transacción Recurrente'}</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField control={form.control} name="name" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Nombre</FormLabel>
                                <FormControl><Input placeholder="Ej: Netflix" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />

                        <div className="grid grid-cols-2 gap-4">
                            <FormField control={form.control} name="amount" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Monto</FormLabel>
                                    <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="day_of_month" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Día del Mes</FormLabel>
                                    <FormControl><Input type="number" min={1} max={31} {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        </div>

                        <FormField control={form.control} name="type" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Tipo</FormLabel>
                                <FormControl>
                                    <Select value={field.value} onValueChange={field.onChange}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="bill">Gasto</SelectItem>
                                            <SelectItem value="income">Ingreso</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />

                        <div className="grid grid-cols-2 gap-4">
                            <FormField control={form.control} name="category_id" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Categoría</FormLabel>
                                    <FormControl>
                                        <Select value={field.value} onValueChange={field.onChange}>
                                            <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                                            <SelectContent>
                                                {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="account_id" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Cuenta</FormLabel>
                                    <FormControl>
                                        <Select value={field.value} onValueChange={field.onChange}>
                                            <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                                            <SelectContent>
                                                {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        </div>

                        <FormField control={form.control} name="description" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Descripción (Opcional)</FormLabel>
                                <FormControl><Input {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />

                        <DialogFooter>
                            <Button type="submit" disabled={isLoading} className="w-full">
                                {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : isEditing ? <Edit className="h-4 w-4 mr-2" /> : <PlusCircle className="h-4 w-4 mr-2" />}
                                {isEditing ? 'Guardar Cambios' : 'Crear'}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
                {error && (
                    <Alert variant="destructive" className="mt-4">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{error.message}</AlertDescription>
                    </Alert>
                )}
            </DialogContent>
        </Dialog>
    )
}
