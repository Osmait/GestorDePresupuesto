'use client'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslations } from 'next-intl'
import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import * as z from 'zod'
import { FormDialog } from '@/components/shared/FormDialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Account } from '@/types/account'

type AccountUpdateModalProps = {
	open: boolean
	setOpen: (_v: boolean) => void
	account: Account | null
	updateAccount: (_id: string, _name: string, _bank: string) => Promise<void>
}

/** Edits an account's name and bank (the initial balance is fixed). */
export function AccountUpdateModal({ open, setOpen, account, updateAccount }: AccountUpdateModalProps) {
	const t = useTranslations('accounts')
	const tForms = useTranslations('forms')
	const [submitError, setSubmitError] = useState<string | null>(null)

	const accountUpdateSchema = useMemo(
		() =>
			z.object({
				name: z
					.string()
					.trim()
					.min(2, t('minChars', { count: 2 })),
				bank: z
					.string()
					.trim()
					.min(2, t('minChars', { count: 2 })),
			}),
		[t],
	)
	type AccountUpdateFormValues = z.infer<typeof accountUpdateSchema>

	const form = useForm<AccountUpdateFormValues>({
		resolver: zodResolver(accountUpdateSchema),
		defaultValues: {
			name: account?.name || '',
			bank: account?.bank || '',
		},
	})

	// Load the selected account into the form.
	useEffect(() => {
		if (account) {
			form.reset({ name: account.name, bank: account.bank })
		}
	}, [account, form])

	function handleOpenChange(next: boolean) {
		if (!next) setSubmitError(null)
		setOpen(next)
	}

	async function onSubmit(values: AccountUpdateFormValues) {
		if (!account?.id) return
		setSubmitError(null)
		try {
			await updateAccount(account.id, values.name, values.bank)
			setOpen(false)
		} catch {
			setSubmitError(t('saveError'))
		}
	}

	return (
		<FormDialog
			open={open}
			onOpenChange={handleOpenChange}
			title={tForms('editAccount')}
			description={t('editDescription')}
			submitLabel={tForms('saveChanges')}
			loading={form.formState.isSubmitting}
			error={submitError}
			onSubmit={form.handleSubmit(onSubmit)}
		>
			<Form {...form}>
				<div className='space-y-4'>
					<FormField
						control={form.control}
						name='name'
						render={({ field }) => (
							<FormItem>
								<FormLabel>{t('name')}</FormLabel>
								<FormControl>
									<Input {...field} placeholder={t('namePlaceholder')} autoComplete='off' />
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
									<Input {...field} placeholder={t('bankPlaceholder')} autoComplete='off' />
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
