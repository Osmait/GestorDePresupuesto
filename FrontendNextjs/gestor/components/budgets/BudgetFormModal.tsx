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
import { useBudgetContext } from '@/components/budgets/BudgetContext'
import { useTranslations } from 'next-intl'

const budgetSchema = z.object({
    category_id: z.string().min(1, 'Required'),
    amount: z.coerce.number().min(1, 'Required'),
})
type BudgetFormValues = z.infer<typeof budgetSchema>

interface BudgetFormModalProps {
    open: boolean
    setOpen: (_v: boolean) => void
}

export function BudgetFormModal({ open, setOpen }: BudgetFormModalProps) {
    const t = useTranslations('forms')
    const { createBudget, updateBudget, editingBudget, setEditingBudget, isLoading, error } = useBudgetContext()
    const { data: categories = [] } = useGetCategories()
    const isEditing = !!editingBudget

    const form = useForm<BudgetFormValues>({
        resolver: zodResolver(budgetSchema),
        defaultValues: { category_id: '', amount: 0 },
        values: editingBudget ? { category_id: editingBudget.category_id, amount: editingBudget.amount } : { category_id: '', amount: 0 }
    })

    async function onSubmit(values: BudgetFormValues) {
        try {
            if (isEditing && editingBudget) {
                await updateBudget(editingBudget.id, values.category_id, values.amount)
            } else {
                await createBudget(values.category_id, values.amount)
            }
            form.reset({ category_id: '', amount: 0 })
        } catch {
            // Error handling is done via the error prop from context
        }
    }

    const handleOpenChange = (open: boolean) => {
        setOpen(open)
        if (!open) {
            setEditingBudget(null)
            form.reset()
        }
    }

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{isEditing ? t('editBudget') : t('newBudget')}</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField control={form.control} name="category_id" render={({ field }) => (
                            <FormItem>
                                <FormLabel>{t('category')}</FormLabel>
                                <FormControl>
                                    <Select value={field.value} onValueChange={field.onChange}>
                                        <SelectTrigger><SelectValue placeholder={t('select')} /></SelectTrigger>
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
                                <FormLabel>{t('amount')}</FormLabel>
                                <FormControl><Input type="number" {...field} min={1} step={0.01} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <DialogFooter>
                            <Button type="submit" disabled={isLoading} className="w-full">
                                {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : isEditing ? <Edit className="h-4 w-4 mr-2" /> : <PlusCircle className="h-4 w-4 mr-2" />}
                                {isEditing ? t('saveChanges') : t('createBudget')}
                            </Button>
                            <DialogClose asChild>
                                <Button type="button" variant="ghost" className="w-full">{t('cancel')}</Button>
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

