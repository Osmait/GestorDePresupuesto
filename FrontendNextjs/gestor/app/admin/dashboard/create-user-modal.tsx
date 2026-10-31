'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff, Plus } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { FormDialog } from '@/components/shared/FormDialog'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { getAdminRepository } from '@/lib/repositoryConfig'

interface CreateUserModalProps {
	onUserCreated: () => void
}

type Translate = (key: string) => string

function createUserSchema(t: Translate) {
	return z.object({
		name: z.string().trim().min(2, t('errors.name')),
		last_name: z.string().trim().min(2, t('errors.lastName')),
		email: z
			.string()
			.trim()
			.pipe(z.email(t('errors.email'))),
		password: z.string().min(8, t('errors.password')),
		role: z.enum(['USER', 'ADMIN']),
	})
}

type CreateUserValues = z.infer<ReturnType<typeof createUserSchema>>

type CreateUserInput = z.input<ReturnType<typeof createUserSchema>>

const DEFAULT_VALUES: CreateUserValues = { name: '', last_name: '', email: '', password: '', role: 'USER' }

export function CreateUserModal({ onUserCreated }: CreateUserModalProps) {
	const t = useTranslations('admin.createUser')
	const tRoles = useTranslations('admin.roles')
	const [isOpen, setIsOpen] = useState(false)
	const [showPassword, setShowPassword] = useState(false)
	const [serverError, setServerError] = useState<string | null>(null)
	const schema = useMemo(() => createUserSchema(t), [t])
	const form = useForm<CreateUserInput, unknown, CreateUserValues>({
		resolver: zodResolver(schema),
		defaultValues: DEFAULT_VALUES,
	})
	const isLoading = form.formState.isSubmitting

	function handleOpenChange(open: boolean) {
		setIsOpen(open)
		if (!open) {
			form.reset(DEFAULT_VALUES)
			setServerError(null)
			setShowPassword(false)
		}
	}

	async function onValid(values: CreateUserValues) {
		setServerError(null)
		try {
			await getAdminRepository().createUser(values)
			toast.success(t('success', { name: `${values.name} ${values.last_name}` }))
			handleOpenChange(false)
			onUserCreated()
		} catch (error: unknown) {
			const message = error instanceof Error ? error.message : String(error)
			setServerError(t('error', { message }))
		}
	}

	return (
		<>
			<Button onClick={() => setIsOpen(true)}>
				<Plus className='mr-2 h-4 w-4' aria-hidden='true' />
				{t('trigger')}
			</Button>
			<FormDialog
				open={isOpen}
				onOpenChange={handleOpenChange}
				title={t('title')}
				description={t('description')}
				submitLabel={t('submit')}
				cancelLabel={t('cancel')}
				loading={isLoading}
				error={serverError}
				onSubmit={form.handleSubmit(onValid)}
			>
				<Form {...form}>
					<div className='space-y-4'>
						<div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
							<FormField
								control={form.control}
								name='name'
								render={({ field }) => (
									<FormItem>
										<FormLabel>{t('firstName')}</FormLabel>
										<FormControl>
											<Input autoComplete='given-name' placeholder={t('firstNamePlaceholder')} {...field} />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name='last_name'
								render={({ field }) => (
									<FormItem>
										<FormLabel>{t('lastName')}</FormLabel>
										<FormControl>
											<Input autoComplete='family-name' placeholder={t('lastNamePlaceholder')} {...field} />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
						</div>

						<FormField
							control={form.control}
							name='email'
							render={({ field }) => (
								<FormItem>
									<FormLabel>{t('email')}</FormLabel>
									<FormControl>
										<Input type='email' autoComplete='off' placeholder={t('emailPlaceholder')} {...field} />
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name='password'
							render={({ field }) => (
								<FormItem>
									<FormLabel>{t('password')}</FormLabel>
									<div className='relative'>
										<FormControl>
											<Input
												type={showPassword ? 'text' : 'password'}
												autoComplete='new-password'
												placeholder={t('passwordPlaceholder')}
												className='pr-11'
												{...field}
											/>
										</FormControl>
										<Button
											type='button'
											variant='ghost'
											size='icon'
											className='absolute right-0 top-0 text-muted-foreground hover:bg-transparent'
											onClick={() => setShowPassword((value) => !value)}
											aria-label={showPassword ? t('hidePassword') : t('showPassword')}
											aria-pressed={showPassword}
										>
											{showPassword ? (
												<EyeOff className='h-4 w-4' aria-hidden='true' />
											) : (
												<Eye className='h-4 w-4' aria-hidden='true' />
											)}
										</Button>
									</div>
									<FormMessage />
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name='role'
							render={({ field }) => (
								<FormItem>
									<FormLabel>{t('role')}</FormLabel>
									<Select value={field.value} onValueChange={field.onChange}>
										<FormControl>
											<SelectTrigger>
												<SelectValue placeholder={t('selectRole')} />
											</SelectTrigger>
										</FormControl>
										<SelectContent>
											<SelectItem value='USER'>{tRoles('USER')}</SelectItem>
											<SelectItem value='ADMIN'>{tRoles('ADMIN')}</SelectItem>
										</SelectContent>
									</Select>
									<FormMessage />
								</FormItem>
							)}
						/>
					</div>
				</Form>
			</FormDialog>
		</>
	)
}
