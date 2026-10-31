'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { AlertCircle, Check, Circle, Eye, EyeOff, Loader2, Lock, Mail, User, UserPlus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { useTranslations } from 'next-intl'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import * as z from 'zod'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { getAuthRepository } from '@/lib/repositoryConfig'
import { cn } from '@/lib/utils'

const FIELD_ICON = 'pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground'

/** Must match the backend password policy (min 8 characters). */
export const PASSWORD_MIN_LENGTH = 8

const NAME_PATTERN = /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/

function buildRegisterSchema(t: (key: string, values?: Record<string, string | number>) => string) {
	return z
		.object({
			name: z.string().min(2, t('nameMin')).max(50, t('nameMax')).regex(NAME_PATTERN, t('nameLetters')),
			lastName: z.string().min(2, t('lastNameMin')).max(50, t('lastNameMax')).regex(NAME_PATTERN, t('lastNameLetters')),
			email: z
				.string()
				.min(1, t('emailRequired'))
				.pipe(z.email(t('emailInvalid')).toLowerCase()),
			password: z
				.string()
				.min(PASSWORD_MIN_LENGTH, t('passwordMinLength', { min: PASSWORD_MIN_LENGTH }))
				.max(100, t('passwordMax'))
				.regex(/(?=.*[a-z])/, t('passwordLowercase'))
				.regex(/(?=.*[A-Z])/, t('passwordUppercase'))
				.regex(/(?=.*\d)/, t('passwordNumber')),
			confirmPassword: z.string().min(1, t('confirmRequired')),
		})
		.refine((data) => data.password === data.confirmPassword, {
			path: ['confirmPassword'],
			message: t('passwordsMismatch'),
			// Only once every field is valid (Zod 3 semantics; Zod 4 runs it alongside field errors).
			when: (payload) => payload.issues.length === 0,
		})
}

type RegisterFormValues = z.infer<ReturnType<typeof buildRegisterSchema>>

type RegisterFormInput = z.input<ReturnType<typeof buildRegisterSchema>>

interface RegisterFormProps {
	onToggleForm?: () => void
	showToggle?: boolean
}

export function RegisterForm({ onToggleForm, showToggle = true }: RegisterFormProps) {
	const t = useTranslations('auth.register')
	const tAuth = useTranslations('auth')
	const registerSchema = useMemo(() => buildRegisterSchema(t), [t])
	const isDevelopment = process.env.NODE_ENV === 'development'
	const [isLoading, setIsLoading] = useState(false)
	const [showPassword, setShowPassword] = useState(false)
	const [showConfirmPassword, setShowConfirmPassword] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [success, setSuccess] = useState(false)
	const router = useRouter()
	const autoLoginTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

	useEffect(() => {
		return () => {
			if (autoLoginTimerRef.current) {
				clearTimeout(autoLoginTimerRef.current)
			}
		}
	}, [])

	const form = useForm<RegisterFormInput, unknown, RegisterFormValues>({
		resolver: zodResolver(registerSchema),
		defaultValues: {
			name: '',
			lastName: '',
			email: '',
			password: '',
			confirmPassword: '',
		},
	})

	const passwordValue = form.watch('password')

	// Validaciones de contraseña en tiempo real (check vs. circle, not color alone)
	const passwordRules = [
		{
			key: 'length',
			label: t('ruleLength', { min: PASSWORD_MIN_LENGTH }),
			met: passwordValue?.length >= PASSWORD_MIN_LENGTH,
		},
		{ key: 'lowercase', label: t('ruleLowercase'), met: /(?=.*[a-z])/.test(passwordValue || '') },
		{ key: 'uppercase', label: t('ruleUppercase'), met: /(?=.*[A-Z])/.test(passwordValue || '') },
		{ key: 'number', label: t('ruleNumber'), met: /(?=.*\d)/.test(passwordValue || '') },
	]

	const onSubmit = async (values: RegisterFormValues) => {
		try {
			setIsLoading(true)
			setError(null)
			setSuccess(false)

			const authRepository = await getAuthRepository()

			// Crear cuenta
			await authRepository.signUp(values.name, values.lastName, values.email, values.password)

			setSuccess(true)

			// Auto-login después del registro
			autoLoginTimerRef.current = setTimeout(async () => {
				try {
					const result = await signIn('credentials', {
						email: values.email,
						password: values.password,
						redirect: false,
					})
					if (result?.error) {
						router.push('/login')
						return
					}
					router.push('/app')
					router.refresh()
				} catch {
					router.push('/login')
				}
			}, 1500)
		} catch (err) {
			setError(err instanceof Error ? err.message : t('error'))
		} finally {
			setIsLoading(false)
		}
	}

	const fillTestData = () => {
		form.setValue('name', 'Carlos')
		form.setValue('lastName', 'López')
		form.setValue('email', 'carlos.lopez@example.com')
		form.setValue('password', 'Test123!')
		form.setValue('confirmPassword', 'Test123!')
	}

	if (success) {
		return (
			<Card className='mx-auto w-full max-w-md' role='status'>
				<CardContent className='space-y-6 p-8 text-center'>
					<div className='flex items-center justify-center'>
						<div className='flex h-16 w-16 items-center justify-center rounded-full bg-success/10'>
							<Check className='h-8 w-8 text-success' aria-hidden='true' />
						</div>
					</div>
					<div className='space-y-2'>
						<h3 className='text-xl font-bold text-foreground'>{t('successTitle')}</h3>
						<p className='text-muted-foreground'>{t('successAutoLogin')}</p>
					</div>
					<div className='flex justify-center'>
						<Loader2 className='h-6 w-6 animate-spin text-primary' />
					</div>
				</CardContent>
			</Card>
		)
	}

	return (
		<Card className='mx-auto w-full max-w-md'>
			<CardHeader className='space-y-1 text-center'>
				<div className='mb-4 flex items-center justify-center'>
					<div className='flex h-12 w-12 items-center justify-center rounded-lg bg-primary'>
						<UserPlus className='h-6 w-6 text-primary-foreground' aria-hidden='true' />
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
						<div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
							<FormField
								control={form.control}
								name='name'
								render={({ field }) => (
									<FormItem>
										<FormLabel>{t('name')}</FormLabel>
										<div className='relative'>
											<User className={FIELD_ICON} aria-hidden='true' />
											<FormControl>
												<Input
													{...field}
													autoComplete='given-name'
													placeholder={t('namePlaceholder')}
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
								name='lastName'
								render={({ field }) => (
									<FormItem>
										<FormLabel>{t('lastName')}</FormLabel>
										<div className='relative'>
											<User className={FIELD_ICON} aria-hidden='true' />
											<FormControl>
												<Input
													{...field}
													autoComplete='family-name'
													placeholder={t('lastNamePlaceholder')}
													disabled={isLoading}
													className='pl-10'
												/>
											</FormControl>
										</div>
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
									<div className='relative'>
										<Mail className={FIELD_ICON} aria-hidden='true' />
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
										<Lock className={FIELD_ICON} aria-hidden='true' />
										<FormControl>
											<Input
												{...field}
												type={showPassword ? 'text' : 'password'}
												autoComplete='new-password'
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
									{passwordValue && (
										<ul className='mt-2 grid grid-cols-2 gap-2 text-xs' aria-label={t('rulesLabel')}>
											{passwordRules.map((rule) => (
												<li
													key={rule.key}
													className={cn('flex items-center gap-1', rule.met ? 'text-success' : 'text-muted-foreground')}
												>
													{rule.met ? (
														<Check className='h-3 w-3 shrink-0' aria-hidden='true' />
													) : (
														<Circle className='h-3 w-3 shrink-0' aria-hidden='true' />
													)}
													{rule.label}
													<span className='sr-only'>({rule.met ? t('ruleMet') : t('ruleNotMet')})</span>
												</li>
											))}
										</ul>
									)}

									<FormMessage />
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name='confirmPassword'
							render={({ field }) => (
								<FormItem>
									<FormLabel>{t('confirmPassword')}</FormLabel>
									<div className='relative'>
										<Lock className={FIELD_ICON} aria-hidden='true' />
										<FormControl>
											<Input
												{...field}
												type={showConfirmPassword ? 'text' : 'password'}
												autoComplete='new-password'
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
											onClick={() => setShowConfirmPassword(!showConfirmPassword)}
											disabled={isLoading}
											aria-label={tAuth('showPassword')}
											aria-pressed={showConfirmPassword}
										>
											{showConfirmPassword ? (
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
									<UserPlus className='mr-2 h-4 w-4' aria-hidden='true' />
									{t('submit')}
								</>
							)}
						</Button>
					</form>
				</Form>

				{/* Datos de prueba: solo en desarrollo */}
				{isDevelopment && (
					<div className='text-center'>
						<Button
							type='button'
							variant='outline'
							size='sm'
							onClick={fillTestData}
							disabled={isLoading}
							className='text-xs'
						>
							<User className='mr-1 h-3 w-3' aria-hidden='true' />
							{t('fillTestData')}
						</Button>
					</div>
				)}

				{/* Toggle para login */}
				{showToggle && onToggleForm && (
					<div className='text-center'>
						<p className='text-sm text-muted-foreground'>
							{t('haveAccount')}{' '}
							<Button
								type='button'
								variant='link'
								className='h-auto p-0 font-semibold'
								onClick={onToggleForm}
								disabled={isLoading}
							>
								{t('signIn')}
							</Button>
						</p>
					</div>
				)}
			</CardContent>
		</Card>
	)
}
