'use client'

import { useState } from 'react'
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
import { Loader2, PlusCircle, AlertCircle } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useGetCategories } from '@/hooks/queries/useCategoriesQuery'
import { useBudgetContext } from '@/components/budgets/BudgetContext'

const budgetSchema = z.object({
    category_id: z.string().min(1, 'Selecciona una categoría'),
    amount: z.coerce.number().min(1, 'El monto debe ser mayor a 0'),
})
type BudgetFormValues = z.infer<typeof budgetSchema>

interface BudgetFormModalProps {
    open: boolean
    setOpen: (v: boolean) => void
}

export function BudgetFormModal({ open, setOpen }: BudgetFormModalProps) {
    const { createBudget, isLoading, error } = useBudgetContext()
    const { data: categories = [] } = useGetCategories()

    const form = useForm<BudgetFormValues>({
        resolver: zodResolver(budgetSchema),
        defaultValues: { category_id: '', amount: 0 },
    })

    async function onSubmit(values: BudgetFormValues) {
        try {
            await createBudget(values.category_id, values.amount)
            setOpen(false)
            form.reset({ category_id: '', amount: 0 })
        } catch { }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Nuevo Presupuesto</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField control={form.control} name="category_id" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Categoría</FormLabel>
                                <FormControl>
                                    <Select value={field.value} onValueChange={field.onChange}>
                                        <SelectTrigger><SelectValue placeholder="Selecciona una categoría" /></SelectTrigger>
                                        <SelectContent>
                                            {categories?.map(cat => <SelectItem key={cat.id} value={cat.id}>{cat.icon} {cat.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="amount" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Monto</FormLabel>
                                <FormControl><Input type="number" {...field} min={1} step={0.01} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <DialogFooter>
                            <Button type="submit" disabled={isLoading} className="w-full">
                                {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <PlusCircle className="h-4 w-4 mr-2" />}
                                Crear Presupuesto
                            </Button>
                            <DialogClose asChild>
                                <Button type="button" variant="ghost" className="w-full">Cancelar</Button>
                            </DialogClose>
                        </DialogFooter>
                    </form>
                </Form>
                {error && (
                    <Alert variant="destructive" className="mt-4">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}
            </DialogContent>
        </Dialog>
    )
}
