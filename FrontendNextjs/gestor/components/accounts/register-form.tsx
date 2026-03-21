'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { AlertCircle, Check, Eye, EyeOff, Loader2, Lock, Mail, User, UserPlus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import * as z from 'zod'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { getAuthRepository } from '@/lib/repositoryConfig'

// Schema de validación con Zod más robusto
const registerSchema = z
	.object({
		name: z
			.string()
			.min(2, 'El nombre debe tener al menos 2 caracteres')
			.max(50, 'El nombre no puede tener más de 50 caracteres')
			.regex(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/, 'El nombre solo puede contener letras'),
		lastName: z
			.string()
			.min(2, 'El apellido debe tener al menos 2 caracteres')
			.max(50, 'El apellido no puede tener más de 50 caracteres')
			.regex(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/, 'El apellido solo puede contener letras'),
		email: z.string().min(1, 'El email es requerido').email('Debe ser un email válido').toLowerCase(),
		password: z
			.string()
			.min(6, 'La contraseña debe tener al menos 6 caracteres')
			.max(100, 'La contraseña no puede tener más de 100 caracteres')
			.regex(/(?=.*[a-z])/, 'Debe contener al menos una letra minúscula')
			.regex(/(?=.*[A-Z])/, 'Debe contener al menos una letra mayúscula')
			.regex(/(?=.*\d)/, 'Debe contener al menos un número'),
		confirmPassword: z.string().min(6, 'Confirma tu contraseña'),
	})
	.refine((data) => data.password === data.confirmPassword, {
		path: ['confirmPassword'],
		message: 'Las contraseñas no coinciden',
	})

type RegisterFormValues = z.infer<typeof registerSchema>

interface RegisterFormProps {
	onToggleForm?: () => void
	showToggle?: boolean
}

export function RegisterForm({ onToggleForm, showToggle = true }: RegisterFormProps) {
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
		length: passwordValue?.length >= 6,
		lowercase: /(?=.*[a-z])/.test(passwordValue || ''),
		uppercase: /(?=.*[A-Z])/.test(passwordValue || ''),
		number: /(?=.*\d)/.test(passwordValue || ''),
	}

	const onSubmit = async (values: RegisterFormValues) => {
		try {
			setIsLoading(true)
			setError(null)
			setSuccess(false)

			console.log('📝 Iniciando registro...')
			const authRepository = await getAuthRepository()

			// Crear cuenta
			await authRepository.signUp(values.name, values.lastName, values.email, values.password)

			console.log('✅ Registro exitoso')
			setSuccess(true)

			// Auto-login después del registro
			autoLoginTimerRef.current = setTimeout(async () => {
				try {
					await authRepository.login(values.email, values.password)
					router.push('/app')
					router.refresh()
				} catch {
					router.push('/login')
				}
			}, 1500)
		} catch (err) {
			console.error('❌ Error en registro:', err)
			setError(err instanceof Error ? err.message : 'Error al crear la cuenta')
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
						<h3 className='text-xl font-bold text-foreground'>¡Cuenta creada exitosamente!</h3>
						<p className='text-muted-foreground'>Iniciando sesión automáticamente...</p>
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
				<CardTitle className='text-2xl font-bold text-center'>Crear Cuenta</CardTitle>
				<CardDescription className='text-muted-foreground'>Completa el formulario para crear tu cuenta</CardDescription>
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
										<FormLabel className='text-sm font-medium'>Nombre</FormLabel>
										<FormControl>
											<div className='relative'>
												<User className='absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground' />
												<Input
													{...field}
													placeholder='Juan'
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
										<FormLabel className='text-sm font-medium'>Apellido</FormLabel>
										<FormControl>
											<div className='relative'>
												<User className='absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground' />
												<Input
													{...field}
													placeholder='Pérez'
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
									<FormLabel className='text-sm font-medium'>Email</FormLabel>
									<FormControl>
										<div className='relative'>
											<Mail className='absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground' />
											<Input
												{...field}
												type='email'
												placeholder='ejemplo@correo.com'
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
									<FormLabel className='text-sm font-medium'>Contraseña</FormLabel>
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
													6+ caracteres
												</div>
												<div
													className={`flex items-center gap-1 ${passwordValidations.lowercase ? 'text-green-600' : 'text-muted-foreground'}`}
												>
													<div
														className={`w-2 h-2 rounded-full ${passwordValidations.lowercase ? 'bg-green-600' : 'bg-muted-foreground'}`}
													/>
													Minúscula
												</div>
												<div
													className={`flex items-center gap-1 ${passwordValidations.uppercase ? 'text-green-600' : 'text-muted-foreground'}`}
												>
													<div
														className={`w-2 h-2 rounded-full ${passwordValidations.uppercase ? 'bg-green-600' : 'bg-muted-foreground'}`}
													/>
													Mayúscula
												</div>
												<div
													className={`flex items-center gap-1 ${passwordValidations.number ? 'text-green-600' : 'text-muted-foreground'}`}
												>
													<div
														className={`w-2 h-2 rounded-full ${passwordValidations.number ? 'bg-green-600' : 'bg-muted-foreground'}`}
													/>
													Número
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
									<FormLabel className='text-sm font-medium'>Confirmar Contraseña</FormLabel>
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
									Creando cuenta...
								</>
							) : (
								<>
									<UserPlus className='mr-2 h-4 w-4' />
									Crear Cuenta
								</>
							)}
						</Button>
					</form>
				</Form>

				{/* Datos de prueba */}
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
						Llenar datos de prueba
					</Button>
				</div>

				{/* Toggle para login */}
				{showToggle && onToggleForm && (
					<div className='text-center'>
						<p className='text-sm text-muted-foreground'>
							¿Ya tienes una cuenta?{' '}
							<Button
								type='button'
								variant='link'
								className='p-0 h-auto font-semibold text-primary hover:text-primary/80'
								onClick={onToggleForm}
								disabled={isLoading}
							>
								Iniciar sesión
							</Button>
						</p>
					</div>
				)}
			</CardContent>
		</Card>
	)
}
