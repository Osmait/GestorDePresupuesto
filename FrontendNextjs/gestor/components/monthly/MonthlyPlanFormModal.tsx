'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslations } from 'next-intl'
import { useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import * as z from 'zod'
import { FormDialog } from '@/components/shared/FormDialog'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useGetAccounts } from '@/hooks/queries/useAccountsQuery'
import { useGetCategories } from '@/hooks/queries/useCategoriesQuery'
import { useCreateMonthlyPlanItem, useUpdateMonthlyPlanItem } from '@/hooks/queries/useMonthlyPlanQuery'
import { hasAtMostDecimals } from '@/lib/money-validation'
import { MonthlyPlanItemRequest } from '@/types/monthlyPlan'
import { useMonthlyPlanContext } from './MonthlyPlanContext'

/** Sentinel for the "no category / no account" option, since Select needs a value. */
const NONE = '__none__'

function createPlanItemSchema(maxTwoDecimals: string) {
	return z.object({
		name: z.string().min(1),
		description: z.string().optional(),
		// monthly_plan_items.amount is NUMERIC(15,2): the API rejects sub-cent amounts.
		amount: z.coerce
			.number()
			.positive()
			.refine((value) => hasAtMostDecimals(value), maxTwoDecimals),
		currency: z.enum(['DOP', 'USD']),
		type: z.enum(['income', 'bill']),
		category_id: z.string().optional(),
		account_id: z.string().optional(),
		// Empty means "no fixed day", which the backend stores as NULL.
		day_of_month: z.union([z.coerce.number().int().min(1).max(31), z.literal('')]).optional(),
	})
}

type PlanItemFormValues = z.infer<ReturnType<typeof createPlanItemSchema>>

export function MonthlyPlanFormModal() {
	const t = useTranslations('monthlyPlan')
	const tForms = useTranslations('forms')
	const planItemSchema = useMemo(() => createPlanItemSchema(tForms('maxTwoDecimals')), [tForms])
	const { isModalOpen, editingItem, defaultType, closeModal, setModalOpen } = useMonthlyPlanContext()
	const { data: categories = [] } = useGetCategories()
	const { data: accounts = [] } = useGetAccounts()

	const createMutation = useCreateMonthlyPlanItem()
	const updateMutation = useUpdateMonthlyPlanItem()

	const isEditing = !!editingItem
	const isLoading = createMutation.isPending || updateMutation.isPending
	const error = createMutation.error || updateMutation.error

	const form = useForm<PlanItemFormValues>({
		resolver: zodResolver(planItemSchema),
		defaultValues: {
			name: '',
			description: '',
			amount: 0,
			currency: 'DOP',
			type: defaultType,
			category_id: NONE,
			account_id: NONE,
			day_of_month: '',
		},
	})

	useEffect(() => {
		if (editingItem) {
			form.reset({
				name: editingItem.name,
				description: editingItem.description || '',
				amount: editingItem.amount,
				currency: editingItem.currency,
				type: editingItem.type,
				category_id: editingItem.category_id || NONE,
				account_id: editingItem.account_id || NONE,
				day_of_month: editingItem.day_of_month ?? '',
			})
		} else {
			form.reset({
				name: '',
				description: '',
				amount: 0,
				currency: 'DOP',
				type: defaultType,
				category_id: NONE,
				account_id: NONE,
				day_of_month: '',
			})
		}
	}, [editingItem, defaultType, form])

	async function onSubmit(values: PlanItemFormValues) {
		const payload: MonthlyPlanItemRequest = {
			name: values.name,
			description: values.description || '',
			amount: values.amount,
			currency: values.currency,
			type: values.type,
			category_id: values.category_id === NONE ? undefined : values.category_id,
			account_id: values.account_id === NONE ? undefined : values.account_id,
			day_of_month: values.day_of_month === '' || values.day_of_month === undefined ? undefined : values.day_of_month,
		}

		try {
			if (isEditing && editingItem) {
				await updateMutation.mutateAsync({
					id: editingItem.id,
					// An edit must not silently resume a paused item.
					data: { ...payload, is_active: editingItem.is_active },
				})
			} else {
				await createMutation.mutateAsync(payload)
			}
			closeModal()
		} catch (e) {
			console.error(e)
		}
	}

	const handleOpenChange = (open: boolean) => {
		setModalOpen(open)
		if (!open) {
			closeModal()
			form.reset()
			createMutation.reset()
			updateMutation.reset()
		}
	}

	return (
		<FormDialog
			open={isModalOpen}
			onOpenChange={handleOpenChange}
			title={isEditing ? t('editItem') : t('newItem')}
			submitLabel={isEditing ? t('saveChanges') : t('create')}
			loading={isLoading}
			error={error?.message}
			onSubmit={form.handleSubmit(onSubmit)}
		>
			<Form {...form}>
				<div className='space-y-4'>
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

					<FormField
						control={form.control}
						name='type'
						render={({ field }) => (
							<FormItem>
								<FormLabel>{t('fieldType')}</FormLabel>
								<Select value={field.value} onValueChange={field.onChange}>
									<FormControl>
										<SelectTrigger>
											<SelectValue />
										</SelectTrigger>
									</FormControl>
									<SelectContent>
										<SelectItem value='bill'>{t('typeBill')}</SelectItem>
										<SelectItem value='income'>{t('typeIncome')}</SelectItem>
									</SelectContent>
								</Select>
								<FormMessage />
							</FormItem>
						)}
					/>

					<div className='grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-3'>
						<FormField
							control={form.control}
							name='amount'
							render={({ field }) => (
								<FormItem className='sm:col-span-2'>
									<FormLabel>{t('fieldAmount')}</FormLabel>
									<FormControl>
										<Input type='number' step='0.01' min='0' {...field} />
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
						<FormField
							control={form.control}
							name='currency'
							render={({ field }) => (
								<FormItem>
									<FormLabel>{t('fieldCurrency')}</FormLabel>
									<Select value={field.value} onValueChange={field.onChange}>
										<FormControl>
											<SelectTrigger>
												<SelectValue />
											</SelectTrigger>
										</FormControl>
										<SelectContent>
											<SelectItem value='DOP'>DOP</SelectItem>
											<SelectItem value='USD'>USD</SelectItem>
										</SelectContent>
									</Select>
									<FormMessage />
								</FormItem>
							)}
						/>
					</div>

					<FormField
						control={form.control}
						name='day_of_month'
						render={({ field }) => (
							<FormItem>
								<FormLabel>{t('fieldDayOfMonth')}</FormLabel>
								<FormControl>
									<Input type='number' min={1} max={31} placeholder={t('dayPlaceholder')} {...field} />
								</FormControl>
								<FormDescription>{t('dayHelp')}</FormDescription>
								<FormMessage />
							</FormItem>
						)}
					/>

					<div className='grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-3'>
						<FormField
							control={form.control}
							name='category_id'
							render={({ field }) => (
								<FormItem>
									<FormLabel>{t('fieldCategory')}</FormLabel>
									<Select value={field.value} onValueChange={field.onChange}>
										<FormControl>
											<SelectTrigger>
												<SelectValue />
											</SelectTrigger>
										</FormControl>
										<SelectContent>
											<SelectItem value={NONE}>{t('none')}</SelectItem>
											{categories.map((category) => (
												<SelectItem key={category.id} value={category.id}>
													{category.name}
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
							name='account_id'
							render={({ field }) => (
								<FormItem>
									<FormLabel>{t('fieldAccount')}</FormLabel>
									<Select value={field.value} onValueChange={field.onChange}>
										<FormControl>
											<SelectTrigger>
												<SelectValue />
											</SelectTrigger>
										</FormControl>
										<SelectContent>
											<SelectItem value={NONE}>{t('none')}</SelectItem>
											{accounts.map((account) => (
												<SelectItem key={account.id} value={account.id}>
													{account.name}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
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
				</div>
			</Form>
		</FormDialog>
	)
}
