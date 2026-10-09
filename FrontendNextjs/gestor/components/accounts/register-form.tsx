'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { AlertCircle, Check, Eye, EyeOff, Loader2, Lock, Mail, User, UserPlus } from 'lucide-react'
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

/** Must match the backend password policy (min 8 characters). */
export const PASSWORD_MIN_LENGTH = 8

const NAME_PATTERN = /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/

function buildRegisterSchema(t: (key: string, values?: Record<string, string | number>) => string) {
	return z
		.object({
			name: z.string().min(2, t('nameMin')).max(50, t('nameMax')).regex(NAME_PATTERN, t('nameLetters')),
			lastName: z.string().min(2, t('lastNameMin')).max(50, t('lastNameMax')).regex(NAME_PATTERN, t('lastNameLetters')),
			email: z.string().min(1, t('emailRequired')).email(t('emailInvalid')).toLowerCase(),
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
		})
}

type RegisterFormValues = z.infer<ReturnType<typeof buildRegisterSchema>>

interface RegisterFormProps {
	onToggleForm?: () => void
	showToggle?: boolean
}

export function RegisterForm({ onToggleForm, showToggle = true }: RegisterFormProps) {
	const t = useTranslations('auth.register')
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

	const form = useForm<RegisterFormValues>({
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

	// Validaciones de contraseña en tiempo real
	const passwordValidations = {
		length: passwordValue?.length >= PASSWORD_MIN_LENGTH,
		lowercase: /(?=.*[a-z])/.test(passwordValue || ''),
		uppercase: /(?=.*[A-Z])/.test(passwordValue || ''),
		number: /(?=.*\d)/.test(passwordValue || ''),
	}

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
			<Card className='w-full max-w-md mx-auto shadow-lg border-border/50'>
				<CardContent className='p-8 text-center space-y-6'>
					<div className='flex items-center justify-center'>
						<div className='w-16 h-16 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center'>
							<Check className='h-8 w-8 text-white' />
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
		<Card className='w-full max-w-md mx-auto shadow-lg border-border/50'>
			<CardHeader className='space-y-1 text-center'>
				<div className='flex items-center justify-center mb-4'>
					<div className='w-12 h-12 bg-gradient-to-br from-primary to-primary/80 rounded-lg flex items-center justify-center'>
						<UserPlus className='h-6 w-6 text-primary-foreground' />
					</div>
				</div>
				<CardTitle className='text-2xl font-bold text-center'>{t('title')}</CardTitle>
				<CardDescription className='text-muted-foreground'>{t('subtitle')}</CardDescription>
			</CardHeader>

			<CardContent className='space-y-6'>
				{error && (
					<Alert variant='destructive'>
						<AlertCircle className='h-4 w-4' />
						<AlertDescription>{error}</AlertDescription>
					</Alert>
				)}

				<Form {...form}>
					<form onSubmit={form.handleSubmit(onSubmit)} className='space-y-4'>
						<div className='grid grid-cols-2 gap-4'>
							<FormField
								control={form.control}
								name='name'
								render={({ field }) => (
									<FormItem>
										<FormLabel className='text-sm font-medium'>{t('name')}</FormLabel>
										<FormControl>
											<div className='relative'>
												<User className='absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground' />
												<Input
													{...field}
													placeholder={t('namePlaceholder')}
													disabled={isLoading}
													className='pl-10 border-border/50 focus:border-primary/50 transition-colors'
												/>
											</div>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>

							<FormField
								control={form.control}
								name='lastName'
								render={({ field }) => (
									<FormItem>
										<FormLabel className='text-sm font-medium'>{t('lastName')}</FormLabel>
										<FormControl>
											<div className='relative'>
												<User className='absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground' />
												<Input
													{...field}
													placeholder={t('lastNamePlaceholder')}
													disabled={isLoading}
													className='pl-10 border-border/50 focus:border-primary/50 transition-colors'
												/>
											</div>
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
									<FormLabel className='text-sm font-medium'>{t('email')}</FormLabel>
									<FormControl>
										<div className='relative'>
											<Mail className='absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground' />
											<Input
												{...field}
												type='email'
												placeholder={t('emailPlaceholder')}
												disabled={isLoading}
												className='pl-10 border-border/50 focus:border-primary/50 transition-colors'
											/>
										</div>
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
									<FormLabel className='text-sm font-medium'>{t('password')}</FormLabel>
									<FormControl>
										<div className='relative'>
											<Lock className='absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground' />
											<Input
												{...field}
												type={showPassword ? 'text' : 'password'}
												placeholder='••••••••'
												disabled={isLoading}
												className='pl-10 pr-10 border-border/50 focus:border-primary/50 transition-colors'
											/>
											<Button
												type='button'
												variant='ghost'
												size='sm'
												className='absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0 hover:bg-transparent'
												onClick={() => setShowPassword(!showPassword)}
												disabled={isLoading}
											>
												{showPassword ? (
													<EyeOff className='h-4 w-4 text-muted-foreground' />
												) : (
													<Eye className='h-4 w-4 text-muted-foreground' />
												)}
											</Button>
										</div>
									</FormControl>

									{/* Indicadores de validación de contraseña */}
									{passwordValue && (
										<div className='mt-2 space-y-1'>
											<div className='grid grid-cols-2 gap-2 text-xs'>
												<div
													className={`flex items-center gap-1 ${passwordValidations.length ? 'text-green-600' : 'text-muted-foreground'}`}
												>
													<div
														className={`w-2 h-2 rounded-full ${passwordValidations.length ? 'bg-green-600' : 'bg-muted-foreground'}`}
													/>
													{t('ruleLength', { min: PASSWORD_MIN_LENGTH })}
												</div>
												<div
													className={`flex items-center gap-1 ${passwordValidations.lowercase ? 'text-green-600' : 'text-muted-foreground'}`}
												>
													<div
														className={`w-2 h-2 rounded-full ${passwordValidations.lowercase ? 'bg-green-600' : 'bg-muted-foreground'}`}
													/>
													{t('ruleLowercase')}
												</div>
												<div
													className={`flex items-center gap-1 ${passwordValidations.uppercase ? 'text-green-600' : 'text-muted-foreground'}`}
												>
													<div
														className={`w-2 h-2 rounded-full ${passwordValidations.uppercase ? 'bg-green-600' : 'bg-muted-foreground'}`}
													/>
													{t('ruleUppercase')}
												</div>
												<div
													className={`flex items-center gap-1 ${passwordValidations.number ? 'text-green-600' : 'text-muted-foreground'}`}
												>
													<div
														className={`w-2 h-2 rounded-full ${passwordValidations.number ? 'bg-green-600' : 'bg-muted-foreground'}`}
													/>
													{t('ruleNumber')}
												</div>
											</div>
										</div>
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
									<FormLabel className='text-sm font-medium'>{t('confirmPassword')}</FormLabel>
									<FormControl>
										<div className='relative'>
											<Lock className='absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground' />
											<Input
												{...field}
												type={showConfirmPassword ? 'text' : 'password'}
												placeholder='••••••••'
												disabled={isLoading}
												className='pl-10 pr-10 border-border/50 focus:border-primary/50 transition-colors'
											/>
											<Button
												type='button'
												variant='ghost'
												size='sm'
												className='absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0 hover:bg-transparent'
												onClick={() => setShowConfirmPassword(!showConfirmPassword)}
												disabled={isLoading}
											>
												{showConfirmPassword ? (
													<EyeOff className='h-4 w-4 text-muted-foreground' />
												) : (
													<Eye className='h-4 w-4 text-muted-foreground' />
												)}
											</Button>
										</div>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						<Button
							type='submit'
							className='w-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground font-medium transition-all duration-200'
							disabled={isLoading}
						>
							{isLoading ? (
								<>
									<Loader2 className='mr-2 h-4 w-4 animate-spin' />
									{t('submitting')}
								</>
							) : (
								<>
									<UserPlus className='mr-2 h-4 w-4' />
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
							className='text-xs border-border/50 hover:bg-muted/30'
						>
							<User className='mr-1 h-3 w-3' />
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
								className='p-0 h-auto font-semibold text-primary hover:text-primary/80'
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
