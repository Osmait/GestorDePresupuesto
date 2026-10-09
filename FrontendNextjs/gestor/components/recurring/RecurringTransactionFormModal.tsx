'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { AlertCircle, Edit, Loader2, PlusCircle } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import * as z from 'zod'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useGetAccounts } from '@/hooks/queries/useAccountsQuery'
import { useGetCategories } from '@/hooks/queries/useCategoriesQuery'
import {
	useCreateRecurringTransactionMutation,
	useUpdateRecurringTransactionMutation,
} from '@/hooks/queries/useRecurringTransactionsQuery'
import { hasAtMostDecimals } from '@/lib/money-validation'
import { useRecurringTransactionContext } from './RecurringTransactionContext'

function createRecurringSchema(t: (key: string) => string, tForms: (key: string) => string) {
	return z.object({
		name: z.string().min(1, t('validation.nameRequired')),
		description: z.string().optional(),
		// recurring_transactions.amount is NUMERIC(15,2): the API rejects sub-cent amounts.
		amount: z.coerce
			.number()
			.min(0.01, t('validation.amountPositive'))
			.refine((value) => hasAtMostDecimals(value), tForms('maxTwoDecimals')),
		type: z.enum(['income', 'bill'], { required_error: t('validation.typeRequired') }),
		account_id: z.string().min(1, t('validation.accountRequired')),
		category_id: z.string().min(1, t('validation.categoryRequired')),
		day_of_month: z.coerce.number().min(1, t('validation.dayRange')).max(31, t('validation.dayRange')),
	})
}

type RecurringFormValues = z.infer<ReturnType<typeof createRecurringSchema>>

export function RecurringTransactionFormModal() {
	const t = useTranslations('recurring')
	const tForms = useTranslations('forms')
	const recurringSchema = useMemo(() => createRecurringSchema(t, tForms), [t, tForms])
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
		},
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
					data: { ...values, description: values.description || '' },
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
			<DialogContent className='max-h-[90vh] overflow-y-auto sm:max-w-[425px]'>
				<DialogHeader>
					<DialogTitle>{isEditing ? t('editTitle') : t('createTitle')}</DialogTitle>
				</DialogHeader>
				<Form {...form}>
					<form onSubmit={form.handleSubmit(onSubmit)} className='space-y-4'>
						<FormField
							control={form.control}
							name='name'
							render={({ field }) => (
								<FormItem>
									<FormLabel>{t('fieldName')}</FormLabel>
									<FormControl>
										<Input placeholder={t('namePlaceholder')} {...field} />
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						<div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
							<FormField
								control={form.control}
								name='amount'
								render={({ field }) => (
									<FormItem>
										<FormLabel>{t('fieldAmount')}</FormLabel>
										<FormControl>
											<Input type='number' step='0.01' {...field} />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name='day_of_month'
								render={({ field }) => (
									<FormItem>
										<FormLabel>{t('fieldDayOfMonth')}</FormLabel>
										<FormControl>
											<Input type='number' min={1} max={31} {...field} />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
						</div>

						<FormField
							control={form.control}
							name='type'
							render={({ field }) => (
								<FormItem>
									<FormLabel>{t('fieldType')}</FormLabel>
									<FormControl>
										<Select value={field.value} onValueChange={field.onChange}>
											<SelectTrigger>
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value='bill'>{t('typeBill')}</SelectItem>
												<SelectItem value='income'>{t('typeIncome')}</SelectItem>
											</SelectContent>
										</Select>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						<div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
							<FormField
								control={form.control}
								name='category_id'
								render={({ field }) => (
									<FormItem>
										<FormLabel>{t('fieldCategory')}</FormLabel>
										<FormControl>
											<Select value={field.value} onValueChange={field.onChange}>
												<SelectTrigger>
													<SelectValue placeholder={t('selectPlaceholder')} />
												</SelectTrigger>
												<SelectContent>
													{categories.map((c) => (
														<SelectItem key={c.id} value={c.id}>
															{c.name}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name='account_id'
								render={({ field }) => (
									<FormItem>
										<FormLabel>{t('fieldAccount')}</FormLabel>
										<FormControl>
											<Select value={field.value} onValueChange={field.onChange}>
												<SelectTrigger>
													<SelectValue placeholder={t('selectPlaceholder')} />
												</SelectTrigger>
												<SelectContent>
													{accounts.map((a) => (
														<SelectItem key={a.id} value={a.id}>
															{a.name}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
						</div>

						<FormField
							control={form.control}
							name='description'
							render={({ field }) => (
								<FormItem>
									<FormLabel>{t('fieldDescription')}</FormLabel>
									<FormControl>
										<Input {...field} />
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						<DialogFooter>
							<Button type='submit' disabled={isLoading} className='w-full'>
								{isLoading ? (
									<Loader2 className='h-4 w-4 animate-spin mr-2' />
								) : isEditing ? (
									<Edit className='h-4 w-4 mr-2' />
								) : (
									<PlusCircle className='h-4 w-4 mr-2' />
								)}
								{isEditing ? t('saveChanges') : t('create')}
							</Button>
						</DialogFooter>
					</form>
				</Form>
				{error && (
					<Alert variant='destructive' className='mt-4'>
						<AlertCircle className='h-4 w-4' />
						<AlertDescription>{error.message}</AlertDescription>
					</Alert>
				)}
			</DialogContent>
		</Dialog>
	)
}
