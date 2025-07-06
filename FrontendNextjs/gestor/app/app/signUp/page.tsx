'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/common/ui/card'
import { Button } from '@/components/common/ui/button'
import { Input } from '@/components/common/ui/input'
import { Label } from '@/components/common/ui/label'
import { Badge } from '@/components/common/ui/badge'
import { 
	UserPlus, 
	Mail, 
	Lock, 
	User, 
	Eye, 
	EyeOff, 
	CheckCircle,
	AlertCircle,
	ArrowRight,
	Shield
} from 'lucide-react'

interface FormData {
	firstName: string
	lastName: string
	email: string
	password: string
	confirmPassword: string
}

interface ValidationErrors {
	firstName?: string
	lastName?: string
	email?: string
	password?: string
	confirmPassword?: string
}

export default function SignUpPage() {
	const [formData, setFormData] = useState<FormData>({
		firstName: '',
		lastName: '',
		email: '',
		password: '',
		confirmPassword: ''
	})
	const [errors, setErrors] = useState<ValidationErrors>({})
	const [showPassword, setShowPassword] = useState(false)
	const [showConfirmPassword, setShowConfirmPassword] = useState(false)
	const [isLoading, setIsLoading] = useState(false)
	const [isSuccess, setIsSuccess] = useState(false)

	const validateForm = (): boolean => {
		const newErrors: ValidationErrors = {}

		// Validar nombre
		if (!formData.firstName.trim()) {
			newErrors.firstName = 'El nombre es requerido'
		}

		// Validar apellido
		if (!formData.lastName.trim()) {
			newErrors.lastName = 'El apellido es requerido'
		}

		// Validar email
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
		if (!formData.email) {
			newErrors.email = 'El email es requerido'
		} else if (!emailRegex.test(formData.email)) {
			newErrors.email = 'Formato de email inválido'
		}

		// Validar contraseña
		if (!formData.password) {
			newErrors.password = 'La contraseña es requerida'
		} else if (formData.password.length < 8) {
			newErrors.password = 'La contraseña debe tener al menos 8 caracteres'
		}

		// Validar confirmación de contraseña
		if (!formData.confirmPassword) {
			newErrors.confirmPassword = 'Confirmar contraseña es requerido'
		} else if (formData.password !== formData.confirmPassword) {
			newErrors.confirmPassword = 'Las contraseñas no coinciden'
		}

		setErrors(newErrors)
		return Object.keys(newErrors).length === 0
	}

	const getPasswordStrength = (password: string): { strength: number; label: string; color: string } => {
		let strength = 0
		if (password.length >= 8) strength++
		if (/[A-Z]/.test(password)) strength++
		if (/[a-z]/.test(password)) strength++
		if (/[0-9]/.test(password)) strength++
		if (/[^A-Za-z0-9]/.test(password)) strength++

		if (strength <= 2) return { strength, label: 'Débil', color: 'text-red-600 dark:text-red-400' }
		if (strength <= 3) return { strength, label: 'Media', color: 'text-orange-600 dark:text-orange-400' }
		if (strength <= 4) return { strength, label: 'Fuerte', color: 'text-green-600 dark:text-green-400' }
		return { strength, label: 'Muy Fuerte', color: 'text-green-700 dark:text-green-300' }
	}

	const handleInputChange = (field: keyof FormData, value: string) => {
		setFormData(prev => ({ ...prev, [field]: value }))
		if (errors[field]) {
			setErrors(prev => ({ ...prev, [field]: undefined }))
		}
	}

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		
		if (!validateForm()) return

		setIsLoading(true)
		
		try {
			// Simular API call
			await new Promise(resolve => setTimeout(resolve, 2000))
			console.log('🎉 Usuario registrado exitosamente:', formData)
			setIsSuccess(true)
		} catch (error) {
			console.error('❌ Error en el registro:', error)
		} finally {
			setIsLoading(false)
		}
	}

	if (isSuccess) {
		return (
			<div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 dark:from-background dark:via-background dark:to-muted/20 flex items-center justify-center p-4">
				<Card className="w-full max-w-md border-border/50 dark:border-border/20">
					<CardContent className="p-8 text-center">
						<div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-6">
							<CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
						</div>
						<h2 className="text-2xl font-bold text-foreground mb-2">¡Registro Exitoso!</h2>
						<p className="text-muted-foreground mb-6">
							Tu cuenta ha sido creada correctamente. Ahora puedes acceder a todas las funcionalidades del sistema.
						</p>
						<Button className="w-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70">
							Iniciar Sesión
							<ArrowRight className="h-4 w-4 ml-2" />
						</Button>
					</CardContent>
				</Card>
			</div>
		)
	}

	const passwordStrength = getPasswordStrength(formData.password)

	return (
		<div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 dark:from-background dark:via-background dark:to-muted/20">
			<div className="container mx-auto px-4 py-8">
				{/* Header */}
				<div className="text-center mb-8">
					<h1 className="text-4xl font-bold bg-gradient-to-r from-foreground via-primary to-primary bg-clip-text text-transparent mb-4">
						Crear Nueva Cuenta
					</h1>
					<p className="text-muted-foreground text-lg">
						Únete a nuestra plataforma de gestión financiera
					</p>
				</div>

				{/* Formulario de registro */}
				<div className="max-w-lg mx-auto">
					<Card className="border-border/50 dark:border-border/20">
						<CardHeader className="text-center">
							<div className="mx-auto w-16 h-16 bg-gradient-to-br from-primary/20 to-primary/10 rounded-full flex items-center justify-center mb-4">
								<UserPlus className="h-8 w-8 text-primary" />
							</div>
							<CardTitle className="text-2xl text-foreground">Registro de Usuario</CardTitle>
							<p className="text-muted-foreground">Completa todos los campos para crear tu cuenta</p>
						</CardHeader>
						<CardContent className="p-6">
							<form onSubmit={handleSubmit} className="space-y-6">
								{/* Nombres */}
								<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
									<div className="space-y-2">
										<Label htmlFor="firstName" className="text-sm font-medium text-foreground">
											Nombre *
										</Label>
										<div className="relative">
											<User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
											<Input
												id="firstName"
												type="text"
												placeholder="Tu nombre"
												value={formData.firstName}
												onChange={(e) => handleInputChange('firstName', e.target.value)}
												className={`pl-10 ${errors.firstName ? 'border-red-500' : ''}`}
											/>
										</div>
										{errors.firstName && (
											<div className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
												<AlertCircle className="h-3 w-3" />
												{errors.firstName}
											</div>
										)}
									</div>

									<div className="space-y-2">
										<Label htmlFor="lastName" className="text-sm font-medium text-foreground">
											Apellido *
										</Label>
										<div className="relative">
											<User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
											<Input
												id="lastName"
												type="text"
												placeholder="Tu apellido"
												value={formData.lastName}
												onChange={(e) => handleInputChange('lastName', e.target.value)}
												className={`pl-10 ${errors.lastName ? 'border-red-500' : ''}`}
											/>
										</div>
										{errors.lastName && (
											<div className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
												<AlertCircle className="h-3 w-3" />
												{errors.lastName}
											</div>
										)}
									</div>
								</div>

								{/* Email */}
								<div className="space-y-2">
									<Label htmlFor="email" className="text-sm font-medium text-foreground">
										Correo Electrónico *
									</Label>
									<div className="relative">
										<Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
										<Input
											id="email"
											type="email"
											placeholder="tu@email.com"
											value={formData.email}
											onChange={(e) => handleInputChange('email', e.target.value)}
											className={`pl-10 ${errors.email ? 'border-red-500' : ''}`}
										/>
									</div>
									{errors.email && (
										<div className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
											<AlertCircle className="h-3 w-3" />
											{errors.email}
										</div>
									)}
								</div>

								{/* Contraseña */}
								<div className="space-y-2">
									<Label htmlFor="password" className="text-sm font-medium text-foreground">
										Contraseña *
									</Label>
									<div className="relative">
										<Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
										<Input
											id="password"
											type={showPassword ? 'text' : 'password'}
											placeholder="Mínimo 8 caracteres"
											value={formData.password}
											onChange={(e) => handleInputChange('password', e.target.value)}
											className={`pl-10 pr-10 ${errors.password ? 'border-red-500' : ''}`}
										/>
										<button
											type="button"
											onClick={() => setShowPassword(!showPassword)}
											className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
										>
											{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
										</button>
									</div>
									{formData.password && (
										<div className="flex items-center justify-between">
											<span className={`text-xs ${passwordStrength.color}`}>
												Fortaleza: {passwordStrength.label}
											</span>
											<div className="flex gap-1">
												{[...Array(5)].map((_, i) => (
													<div
														key={i}
														className={`h-1 w-6 rounded ${
															i < passwordStrength.strength 
																? passwordStrength.color.includes('red') 
																	? 'bg-red-500' 
																	: passwordStrength.color.includes('orange')
																	? 'bg-orange-500'
																	: 'bg-green-500'
																: 'bg-muted'
														}`}
													/>
												))}
											</div>
										</div>
									)}
									{errors.password && (
										<div className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
											<AlertCircle className="h-3 w-3" />
											{errors.password}
										</div>
									)}
								</div>

								{/* Confirmar Contraseña */}
								<div className="space-y-2">
									<Label htmlFor="confirmPassword" className="text-sm font-medium text-foreground">
										Confirmar Contraseña *
									</Label>
									<div className="relative">
										<Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
										<Input
											id="confirmPassword"
											type={showConfirmPassword ? 'text' : 'password'}
											placeholder="Repite tu contraseña"
											value={formData.confirmPassword}
											onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
											className={`pl-10 pr-10 ${errors.confirmPassword ? 'border-red-500' : ''}`}
										/>
										<button
											type="button"
											onClick={() => setShowConfirmPassword(!showConfirmPassword)}
											className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
										>
											{showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
										</button>
									</div>
									{formData.confirmPassword && formData.password === formData.confirmPassword && (
										<div className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
											<CheckCircle className="h-3 w-3" />
											Las contraseñas coinciden
										</div>
									)}
									{errors.confirmPassword && (
										<div className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
											<AlertCircle className="h-3 w-3" />
											{errors.confirmPassword}
										</div>
									)}
								</div>

								{/* Información de seguridad */}
								<Card className="bg-blue-50/50 dark:bg-blue-900/10 border-blue-200/50 dark:border-blue-800/30">
									<CardContent className="p-4">
										<div className="flex items-start gap-3">
											<Shield className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
											<div>
												<p className="text-sm font-medium text-blue-800 dark:text-blue-200">
													Información de Seguridad
												</p>
												<p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
													Tu información está protegida con encriptación de nivel bancario. 
													Nunca compartimos tus datos con terceros.
												</p>
											</div>
										</div>
									</CardContent>
								</Card>

								{/* Botón de registro */}
								<Button
									type="submit"
									disabled={isLoading}
									className="w-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 disabled:opacity-50"
								>
									{isLoading ? (
										<>
											<div className="animate-spin rounded-full h-4 w-4 border-2 border-primary-foreground border-t-transparent mr-2" />
											Creando cuenta...
										</>
									) : (
										<>
											<UserPlus className="h-4 w-4 mr-2" />
											Crear Cuenta
										</>
									)}
								</Button>
							</form>

							{/* Link a login */}
							<div className="mt-6 text-center">
								<p className="text-sm text-muted-foreground">
									¿Ya tienes una cuenta?{' '}
									<Button variant="link" className="p-0 h-auto text-primary hover:text-primary/80">
										Inicia sesión aquí
									</Button>
								</p>
							</div>
						</CardContent>
					</Card>
				</div>

				{/* Beneficios */}
				<div className="mt-12 max-w-4xl mx-auto">
					<div className="text-center mb-8">
						<h2 className="text-2xl font-bold text-foreground mb-2">
							¿Por qué elegir nuestra plataforma?
						</h2>
						<p className="text-muted-foreground">
							Descubre las ventajas de gestionar tus finanzas con nosotros
						</p>
					</div>
					<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
						<Card className="border-border/50 dark:border-border/20 text-center">
							<CardContent className="p-6">
								<div className="mx-auto w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
									<Shield className="h-6 w-6 text-green-600 dark:text-green-400" />
								</div>
								<h3 className="font-semibold text-foreground mb-2">Seguridad Avanzada</h3>
								<p className="text-sm text-muted-foreground">
									Protección bancaria con encriptación de extremo a extremo
								</p>
							</CardContent>
						</Card>
						<Card className="border-border/50 dark:border-border/20 text-center">
							<CardContent className="p-6">
								<div className="mx-auto w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-4">
									<CheckCircle className="h-6 w-6 text-blue-600 dark:text-blue-400" />
								</div>
								<h3 className="font-semibold text-foreground mb-2">Fácil de Usar</h3>
								<p className="text-sm text-muted-foreground">
									Interface intuitiva diseñada para todos los usuarios
								</p>
							</CardContent>
						</Card>
						<Card className="border-border/50 dark:border-border/20 text-center">
							<CardContent className="p-6">
								<div className="mx-auto w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center mb-4">
									<UserPlus className="h-6 w-6 text-purple-600 dark:text-purple-400" />
								</div>
								<h3 className="font-semibold text-foreground mb-2">Soporte 24/7</h3>
								<p className="text-sm text-muted-foreground">
									Asistencia completa disponible en todo momento
								</p>
							</CardContent>
						</Card>
					</div>
				</div>
			</div>
		</div>
	)
}
