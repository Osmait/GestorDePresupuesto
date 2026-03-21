'use client'
import { zodResolver } from '@hookform/resolvers/zod'
import { AlertCircle, Edit, Loader2 } from 'lucide-react'
import React from 'react'
import { useForm } from 'react-hook-form'
import * as z from 'zod'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Account } from '@/types/account'

const accountUpdateSchema = z.object({
	name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
	bank: z.string().min(2, 'El banco debe tener al menos 2 caracteres'),
})
type AccountUpdateFormValues = z.infer<typeof accountUpdateSchema>

type AccountUpdateModalProps = {
	open: boolean
	setOpen: (_v: boolean) => void
	account: Account | null
	updateAccount: (_id: string, _name: string, _bank: string) => Promise<void>
	isLoading: boolean
	error: string | null
}

export function AccountUpdateModal({
	open,
	setOpen,
	account,
	updateAccount,
	isLoading,
	error,
}: AccountUpdateModalProps) {
	const form = useForm<AccountUpdateFormValues>({
		resolver: zodResolver(accountUpdateSchema),
		defaultValues: {
			name: account?.name || '',
			bank: account?.bank || '',
		},
	})

	// Update form values when account changes
	React.useEffect(() => {
		if (account) {
			form.reset({
				name: account.name,
				bank: account.bank,
			})
		}
	}, [account, form])

	async function onSubmit(values: AccountUpdateFormValues) {
		if (!account?.id) return

		try {
			await updateAccount(account.id, values.name, values.bank)
			setOpen(false)
		} catch (error) {
			console.error('Error updating account:', error)
		}
	}

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Editar Cuenta</DialogTitle>
				</DialogHeader>
				<Form {...form}>
					<form onSubmit={form.handleSubmit(onSubmit)} className='space-y-4'>
						<FormField
							control={form.control}
							name='name'
							render={({ field }) => (
								<FormItem>
									<FormLabel>Nombre de la cuenta</FormLabel>
									<FormControl>
										<Input {...field} placeholder='Ej: Cuenta Principal' />
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
									<FormLabel>Banco</FormLabel>
									<FormControl>
										<Input {...field} placeholder='Ej: Banco Nacional' />
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
						<div className='text-sm text-muted-foreground bg-muted/30 p-3 rounded-md'>
							<p>
								<strong>Nota:</strong> Solo puedes editar el nombre y banco de la cuenta. El balance inicial no se puede
								modificar.
							</p>
						</div>
						<DialogFooter>
							<Button type='submit' disabled={isLoading} className='w-full'>
								{isLoading ? <Loader2 className='h-4 w-4 animate-spin mr-2' /> : <Edit className='h-4 w-4 mr-2' />}
								Actualizar Cuenta
							</Button>
							<DialogClose asChild>
								<Button type='button' variant='ghost' className='w-full'>
									Cancelar
								</Button>
							</DialogClose>
						</DialogFooter>
					</form>
				</Form>
				{error && (
					<Alert variant='destructive' className='mt-4'>
						<AlertCircle className='h-4 w-4' />
						<AlertDescription>{error}</AlertDescription>
					</Alert>
				)}
			</DialogContent>
		</Dialog>
	)
}
