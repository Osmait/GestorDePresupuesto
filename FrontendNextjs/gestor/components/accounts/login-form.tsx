'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { AlertCircle, Eye, EyeOff, Loader2, Lock, LogIn, Mail } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import * as z from 'zod'
import { PasskeyLoginButton } from '@/components/auth/PasskeyLoginButton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { getCallbackUrlFromLocation } from '@/lib/auth/callback-url'

interface LoginFormProps {
	onToggleForm?: () => void
	showToggle?: boolean
}

export function LoginForm({ onToggleForm, showToggle = true }: LoginFormProps) {
	const t = useTranslations('auth.login')
	const tAuth = useTranslations('auth')
	const [isLoading, setIsLoading] = useState(false)
	const [showPassword, setShowPassword] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const router = useRouter()

	// Schema de validación con Zod (con mensajes traducidos)
	const loginSchema = z.object({
		email: z.string().min(1, t('emailRequired')).email(t('emailInvalid')),
		// Login only checks presence: the password policy is enforced at registration.
		password: z.string().min(1, t('passwordRequired')).max(100, t('passwordTooLong')),
	})

	type LoginFormValues = z.infer<typeof loginSchema>

	const form = useForm<LoginFormValues>({
		resolver: zodResolver(loginSchema),
		defaultValues: {
			email: '',
			password: '',
		},
	})

	const onSubmit = async (values: LoginFormValues) => {
		try {
			setIsLoading(true)
			setError(null)

			const result = await signIn('credentials', {
				email: values.email,
				password: values.password,
				redirect: false,
			})

			if (result?.error) {
				setError(t('invalidCredentials'))
				return
			}

			router.push(getCallbackUrlFromLocation())
			router.refresh()
		} catch (err) {
			setError(err instanceof Error ? err.message : t('error'))
		} finally {
			setIsLoading(false)
		}
	}

	return (
		<Card className='mx-auto w-full max-w-md'>
			<CardHeader className='space-y-1 text-center'>
				<div className='mb-4 flex items-center justify-center'>
					<div className='flex h-12 w-12 items-center justify-center rounded-lg bg-primary'>
						<LogIn className='h-6 w-6 text-primary-foreground' aria-hidden='true' />
					</div>
				</div>
				<CardTitle className='text-center text-2xl font-bold'>{t('title')}</CardTitle>
				<CardDescription>{t('subtitle')}</CardDescription>
			</CardHeader>

			<CardContent className='space-y-6'>
				{error && (
					<Alert variant='destructive'>
						<AlertCircle className='h-4 w-4' aria-hidden='true' />
						<AlertDescription>{error}</AlertDescription>
					</Alert>
				)}

				<Form {...form}>
					<form onSubmit={form.handleSubmit(onSubmit)} className='space-y-4'>
						<FormField
							control={form.control}
							name='email'
							render={({ field }) => (
								<FormItem>
									<FormLabel>{t('email')}</FormLabel>
									<div className='relative'>
										<Mail
											className='pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground'
											aria-hidden='true'
										/>
										<FormControl>
											<Input
												{...field}
												type='email'
												autoComplete='email'
												placeholder={t('emailPlaceholder')}
												disabled={isLoading}
												className='pl-10'
											/>
										</FormControl>
									</div>
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
										<Lock
											className='pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground'
											aria-hidden='true'
										/>
										<FormControl>
											<Input
												{...field}
												type={showPassword ? 'text' : 'password'}
												autoComplete='current-password'
												placeholder='••••••••'
												disabled={isLoading}
												className='pl-10 pr-11'
											/>
										</FormControl>
										<Button
											type='button'
											variant='ghost'
											size='icon'
											className='absolute right-0 top-0 text-muted-foreground hover:bg-transparent hover:text-foreground'
											onClick={() => setShowPassword(!showPassword)}
											disabled={isLoading}
											aria-label={tAuth('showPassword')}
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

						<Button type='submit' className='w-full' disabled={isLoading} aria-busy={isLoading || undefined}>
							{isLoading ? (
								<>
									<Loader2 className='mr-2 h-4 w-4 animate-spin' aria-hidden='true' />
									{t('submitting')}
								</>
							) : (
								<>
									<LogIn className='mr-2 h-4 w-4' aria-hidden='true' />
									{t('submit')}
								</>
							)}
						</Button>
					</form>
				</Form>

				<div className='relative'>
					<div className='absolute inset-0 flex items-center' aria-hidden='true'>
						<span className='w-full border-t border-border' />
					</div>
					<div className='relative flex justify-center text-xs uppercase'>
						<span className='bg-card px-2 text-muted-foreground'>{t('or')}</span>
					</div>
				</div>

				<PasskeyLoginButton className='w-full' disabled={isLoading} />

				{/* Toggle para registro */}
				{showToggle && onToggleForm && (
					<div className='text-center'>
						<p className='text-sm text-muted-foreground'>
							{t('noAccount')}{' '}
							<Button
								type='button'
								variant='link'
								className='h-auto p-0 font-semibold'
								onClick={onToggleForm}
								disabled={isLoading}
							>
								{t('createAccount')}
							</Button>
						</p>
					</div>
				)}
			</CardContent>
		</Card>
	)
}
