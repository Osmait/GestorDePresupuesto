'use client'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslations } from 'next-intl'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import * as z from 'zod'
import { FormDialog } from '@/components/shared/FormDialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'

type AccountFormModalProps = {
	open: boolean
	setOpen: (_v: boolean) => void
	/** Creates the account. Resolve to close (the caller closes); reject to keep the dialog open with an error. */
	createAccount: (_name: string, _bank: string, _initial_balance: number) => Promise<void>
	/** External busy state (e.g. the mutation's isPending). */
	isLoading: boolean
	/** External error message to show inline (e.g. the mutation's error). */
	error: string | null
}

export function AccountFormModal({ open, setOpen, createAccount, isLoading, error }: AccountFormModalProps) {
	const t = useTranslations('forms')
	const tAcc = useTranslations('accounts')
	const [submitError, setSubmitError] = useState<string | null>(null)

	const accountSchema = useMemo(
		() =>
			z.object({
				name: z
					.string()
					.trim()
					.min(2, tAcc('minChars', { count: 2 })),
				bank: z
					.string()
					.trim()
					.min(2, tAcc('minChars', { count: 2 })),
				initial_balance: z.coerce.number<number>().min(0, tAcc('balanceMin')),
			}),
		[tAcc],
	)
	type AccountFormValues = z.infer<typeof accountSchema>
	type AccountFormInput = z.input<typeof accountSchema>

	const form = useForm<AccountFormInput, unknown, AccountFormValues>({
		resolver: zodResolver(accountSchema),
		defaultValues: { name: '', bank: '', initial_balance: 0 },
	})

	function handleOpenChange(next: boolean) {
		if (!next) setSubmitError(null)
		setOpen(next)
	}

	async function onSubmit(values: AccountFormValues) {
		setSubmitError(null)
		try {
			await createAccount(values.name, values.bank, values.initial_balance)
			form.reset()
		} catch {
			setSubmitError(tAcc('createError'))
		}
	}

	return (
		<FormDialog
			open={open}
			onOpenChange={handleOpenChange}
			title={t('newAccount')}
			submitLabel={t('createAccount')}
			loading={isLoading || form.formState.isSubmitting}
			error={error ?? submitError}
			onSubmit={form.handleSubmit(onSubmit)}
		>
			<Form {...form}>
				<div className='space-y-4'>
					<FormField
						control={form.control}
						name='name'
						render={({ field }) => (
							<FormItem>
								<FormLabel>{tAcc('name')}</FormLabel>
								<FormControl>
									<Input {...field} placeholder={tAcc('namePlaceholder')} autoComplete='off' />
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>
					<FormField
						control={form.control}
						name='bank'
						render={({ field }) => (
							<FormItem>
								<FormLabel>{t('bank')}</FormLabel>
								<FormControl>
									<Input {...field} placeholder={tAcc('bankPlaceholder')} autoComplete='off' />
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>
					<FormField
						control={form.control}
						name='initial_balance'
						render={({ field }) => (
							<FormItem>
								<FormLabel>{t('initialBalance')}</FormLabel>
								<FormControl>
									<Input type='number' inputMode='decimal' {...field} min={0} step={0.01} />
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
