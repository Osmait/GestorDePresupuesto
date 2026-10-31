'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslations } from 'next-intl'
import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import * as z from 'zod'
import { useBudgetContext } from '@/components/budgets/BudgetContext'
import { FormDialog } from '@/components/shared/FormDialog'
import { MoneyInput } from '@/components/shared/MoneyInput'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useGetCategories } from '@/hooks/queries/useCategoriesQuery'
import { moneyMessages, moneySchema } from '@/lib/money-input'

interface BudgetFormModalProps {
	open: boolean
	setOpen: (_v: boolean) => void
	initialCategoryId?: string
	/** Called after a successful create/update (e.g. to refresh server-rendered pages). */
	onSaved?: () => void
}

export function BudgetFormModal({ open, setOpen, initialCategoryId, onSaved }: BudgetFormModalProps) {
	const t = useTranslations('forms')
	const tBudgets = useTranslations('budgets')
	const { createBudget, updateBudget, editingBudget, setEditingBudget } = useBudgetContext()
	const { data: categories = [] } = useGetCategories()
	const [submitError, setSubmitError] = useState<string | null>(null)
	const isEditing = !!editingBudget

	const budgetSchema = useMemo(
		() =>
			z.object({
				category_id: z.string().min(1, t('categoryRequired')),
				amount: moneySchema(moneyMessages(t, { required: t('amountRequired') })).pipe(
					z.number().min(1, t('amountRequired')),
				),
			}),
		[t],
	)
	type BudgetFormValues = z.infer<typeof budgetSchema>
	type BudgetFormInput = z.input<typeof budgetSchema>

	const form = useForm<BudgetFormInput, unknown, BudgetFormValues>({
		resolver: zodResolver(budgetSchema),
		defaultValues: { category_id: '', amount: 0 },
		values: editingBudget
			? { category_id: editingBudget.category_id, amount: editingBudget.amount }
			: { category_id: '', amount: 0 },
	})

	async function onSubmit(values: BudgetFormValues) {
		setSubmitError(null)
		try {
			if (isEditing && editingBudget) {
				await updateBudget(editingBudget.id, values.category_id, values.amount)
			} else {
				await createBudget(values.category_id, values.amount)
			}
			form.reset({ category_id: '', amount: 0 })
			// The context closes its own modal state; also close whoever owns `open`
			// (the global "+" menu passes its own setter).
			setOpen(false)
			onSaved?.()
		} catch {
			setSubmitError(tBudgets('saveError'))
		}
	}

	const handleOpenChange = (next: boolean) => {
		setOpen(next)
		if (!next) {
			setEditingBudget(null)
			setSubmitError(null)
			form.reset()
		}
	}

	useEffect(() => {
		if (!open || isEditing || !initialCategoryId) return
		form.setValue('category_id', initialCategoryId)
	}, [form, initialCategoryId, isEditing, open])

	return (
		<FormDialog
			open={open}
			onOpenChange={handleOpenChange}
			title={isEditing ? t('editBudget') : t('newBudget')}
			submitLabel={isEditing ? t('saveChanges') : t('createBudget')}
			loading={form.formState.isSubmitting}
			error={submitError}
			onSubmit={form.handleSubmit(onSubmit)}
		>
			<Form {...form}>
				<div className='space-y-4'>
					<FormField
						control={form.control}
						name='category_id'
						render={({ field }) => (
							<FormItem>
								<FormLabel>{t('category')}</FormLabel>
								<Select value={field.value} onValueChange={field.onChange}>
									<FormControl>
										<SelectTrigger>
											<SelectValue placeholder={t('select')} />
										</SelectTrigger>
									</FormControl>
									<SelectContent>
										{categories?.map((cat) => (
											<SelectItem key={cat.id} value={cat.id}>
												{cat.icon} {cat.name}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								<FormMessage />
							</FormItem>
						)}
					/>
					<FormField
						control={form.control}
						name='amount'
						render={({ field }) => (
							<FormItem>
								<FormLabel>{t('amount')}</FormLabel>
								<FormControl>
									<MoneyInput {...field} />
								</FormControl>
								<FormDescription>{tBudgets('spentHint')}</FormDescription>
								<FormMessage />
							</FormItem>
						)}
					/>
				</div>
			</Form>
		</FormDialog>
	)
}
