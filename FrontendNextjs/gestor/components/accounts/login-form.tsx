'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import * as z from 'zod'
import { Eye, EyeOff, Mail, Lock, User, AlertCircle, Loader2, LogIn } from 'lucide-react'

import { Button } from '@/components/common/ui/button'
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from '@/components/common/ui/form'
import { Input } from '@/components/common/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/common/ui/card'
import { Alert, AlertDescription } from '@/components/common/ui/alert'
import { getAuthRepository } from '@/lib/repositoryConfig'

// Schema de validación con Zod
const loginSchema = z.object({
	email: z
		.string()
		.min(1, 'El email es requerido')
		.email('Debe ser un email válido'),
	password: z
		.string()
		.min(6, 'La contraseña debe tener al menos 6 caracteres')
		.max(100, 'La contraseña no puede tener más de 100 caracteres'),
})

type LoginFormValues = z.infer<typeof loginSchema>

interface LoginFormProps {
	onToggleForm?: () => void
	showToggle?: boolean
}

export function LoginForm({ onToggleForm, showToggle = true }: LoginFormProps) {
	const [isLoading, setIsLoading] = useState(false)
	const [showPassword, setShowPassword] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const router = useRouter()

	const form = useForm<LoginFormValues>({
		resolver: zodResolver(loginSchema),
		defaultValues: {
			email: 'juan.perez@example.com', // Datos por defecto para testing
			password: 'password123',
		},
	})

	const onSubmit = async (values: LoginFormValues) => {
		try {
			setIsLoading(true)
			setError(null)

			console.log('🔐 Iniciando login...')
			const authRepository = await getAuthRepository()
			const user = await authRepository.login(values.email, values.password)

			console.log('✅ Login exitoso:', user)
			
			// Redirigir al dashboard
			router.push('/app')
			router.refresh()
		} catch (err) {
			console.error('❌ Error en login:', err)
			setError(err instanceof Error ? err.message : 'Error al iniciar sesión')
		} finally {
			setIsLoading(false)
		}
	}

	const fillTestData = (userType: 'juan' | 'maria') => {
		if (userType === 'juan') {
			form.setValue('email', 'juan.perez@example.com')
			form.setValue('password', 'password123')
		} else {
			form.setValue('email', 'maria.gonzalez@example.com')
			form.setValue('password', 'password456')
		}
	}

	return (
		<Card className="w-full max-w-md mx-auto shadow-lg border-border/50">
			<CardHeader className="space-y-1 text-center">
				<div className="flex items-center justify-center mb-4">
					<div className="w-12 h-12 bg-gradient-to-br from-primary to-primary/80 rounded-lg flex items-center justify-center">
						<LogIn className="h-6 w-6 text-primary-foreground" />
					</div>
				</div>
				<CardTitle className="text-2xl font-bold bg-gradient-to-r from-foreground to-primary bg-clip-text text-transparent">
					Iniciar Sesión
				</CardTitle>
				<CardDescription className="text-muted-foreground">
					Ingresa tus credenciales para acceder al sistema
				</CardDescription>
			</CardHeader>

			<CardContent className="space-y-6">
				{error && (
					<Alert variant="destructive">
						<AlertCircle className="h-4 w-4" />
						<AlertDescription>{error}</AlertDescription>
					</Alert>
				)}

				<Form {...form}>
					<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
						<FormField
							control={form.control}
							name="email"
							render={({ field }) => (
								<FormItem>
									<FormLabel className="text-sm font-medium">Email</FormLabel>
									<FormControl>
										<div className="relative">
											<Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
											<Input
												{...field}
												type="email"
												placeholder="ejemplo@correo.com"
												disabled={isLoading}
												className="pl-10 border-border/50 focus:border-primary/50 transition-colors"
											/>
										</div>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name="password"
							render={({ field }) => (
								<FormItem>
									<FormLabel className="text-sm font-medium">Contraseña</FormLabel>
									<FormControl>
										<div className="relative">
											<Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
											<Input
												{...field}
												type={showPassword ? 'text' : 'password'}
												placeholder="••••••••"
												disabled={isLoading}
												className="pl-10 pr-10 border-border/50 focus:border-primary/50 transition-colors"
											/>
											<Button
												type="button"
												variant="ghost"
												size="sm"
												className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0 hover:bg-transparent"
												onClick={() => setShowPassword(!showPassword)}
												disabled={isLoading}
											>
												{showPassword ? (
													<EyeOff className="h-4 w-4 text-muted-foreground" />
												) : (
													<Eye className="h-4 w-4 text-muted-foreground" />
												)}
											</Button>
										</div>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						<Button
							type="submit"
							className="w-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground font-medium transition-all duration-200"
							disabled={isLoading}
						>
							{isLoading ? (
								<>
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									Iniciando sesión...
								</>
							) : (
								<>
									<LogIn className="mr-2 h-4 w-4" />
									Iniciar Sesión
								</>
							)}
						</Button>
					</form>
				</Form>

				{/* Datos de prueba */}
				<div className="space-y-3">
					<div className="text-center">
						<p className="text-xs text-muted-foreground mb-2">Datos de prueba:</p>
						<div className="flex gap-2 justify-center">
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={() => fillTestData('juan')}
								disabled={isLoading}
								className="text-xs border-border/50 hover:bg-muted/30"
							>
								<User className="mr-1 h-3 w-3" />
								Juan
							</Button>
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={() => fillTestData('maria')}
								disabled={isLoading}
								className="text-xs border-border/50 hover:bg-muted/30"
							>
								<User className="mr-1 h-3 w-3" />
								María
							</Button>
						</div>
					</div>
				</div>

				{/* Toggle para registro */}
				{showToggle && onToggleForm && (
					<div className="text-center">
						<p className="text-sm text-muted-foreground">
							¿No tienes una cuenta?{' '}
							<Button
								type="button"
								variant="link"
								className="p-0 h-auto font-semibold text-primary hover:text-primary/80"
								onClick={onToggleForm}
								disabled={isLoading}
							>
								Crear cuenta
							</Button>
						</p>
					</div>
				)}

				{/* Enlaces adicionales */}
				<div className="flex justify-center space-x-4 text-xs text-muted-foreground">
					<Link
						href="/simple-test"
						className="hover:text-primary transition-colors"
					>
						Test Simple
					</Link>
					<span>•</span>
					<Link
						href="/debug"
						className="hover:text-primary transition-colors"
					>
						Debug
					</Link>
				</div>
			</CardContent>
		</Card>
	)
} 