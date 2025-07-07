'use client'

import { useState } from 'react'
import { LoginForm } from './login-form'
import { RegisterForm } from './register-form'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ModeToggle } from '@/components/common/ToggleMode'
import { Home, LogIn, UserPlus } from 'lucide-react'
import Link from 'next/link'

interface AuthContainerProps {
	initialMode?: 'login' | 'register'
}

export function AuthContainer({ initialMode = 'login' }: AuthContainerProps) {
	const [mode, setMode] = useState<'login' | 'register'>(initialMode)

	const toggleMode = () => {
		setMode(mode === 'login' ? 'register' : 'login')
	}

	return (
		<div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 dark:from-background dark:via-background dark:to-muted/20 flex items-center justify-center p-4">
			{/* Contenedor principal */}
			<div className="w-full max-w-md space-y-8">
				{/* Header con navegación y branding */}
				<div className="text-center space-y-6">
					{/* Logo y título de la aplicación */}
					<div className="flex items-center justify-center">
						<Link href="/" className="group flex items-center gap-3 hover:scale-105 transition-transform duration-200">
							<div className="w-12 h-12 bg-gradient-to-br from-primary to-primary/80 rounded-xl flex items-center justify-center shadow-lg">
								<Home className="h-6 w-6 text-primary-foreground" />
							</div>
							<div className="text-left">
								<h1 className="text-2xl font-bold bg-gradient-to-r from-foreground to-primary bg-clip-text text-transparent">
									FinanceApp
								</h1>
								<p className="text-sm text-muted-foreground">Gestor Personal</p>
							</div>
						</Link>
					</div>

					{/* Tabs de navegación */}
					<div className="flex items-center justify-center">
						<Card className="p-1 bg-muted/30 border-border/50">
							<div className="flex rounded-lg">
								<button
									onClick={() => setMode('login')}
									className={`flex items-center gap-2 px-6 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
										mode === 'login'
											? 'bg-background text-foreground shadow-sm border border-border/50'
											: 'text-muted-foreground hover:text-foreground hover:bg-background/50'
									}`}
								>
									<LogIn className="h-4 w-4" />
									Iniciar Sesión
								</button>
								<button
									onClick={() => setMode('register')}
									className={`flex items-center gap-2 px-6 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
										mode === 'register'
											? 'bg-background text-foreground shadow-sm border border-border/50'
											: 'text-muted-foreground hover:text-foreground hover:bg-background/50'
									}`}
								>
									<UserPlus className="h-4 w-4" />
									Crear Cuenta
								</button>
							</div>
						</Card>
					</div>

					{/* Badge de modo de desarrollo */}
					<div className="flex items-center justify-center gap-2">
						<Badge variant="outline" className="text-xs border-border/50 bg-muted/30">
							Modo Desarrollo
						</Badge>
						<ModeToggle />
					</div>
				</div>

				{/* Formulario actual */}
				<div className="transition-all duration-300 ease-in-out">
					{mode === 'login' ? (
						<LoginForm onToggleForm={toggleMode} showToggle={false} />
					) : (
						<RegisterForm onToggleForm={toggleMode} showToggle={false} />
					)}
				</div>

				{/* Footer con información adicional */}
				<div className="text-center space-y-4">
					{/* Enlaces de navegación */}
					<div className="flex justify-center space-x-4 text-xs text-muted-foreground">
						<Link
							href="/simple-test"
							className="hover:text-primary transition-colors underline-offset-4 hover:underline"
						>
							Test Simple
						</Link>
						<span>•</span>
						<Link
							href="/debug"
							className="hover:text-primary transition-colors underline-offset-4 hover:underline"
						>
							Debug
						</Link>
						<span>•</span>
						<Link
							href="/test"
							className="hover:text-primary transition-colors underline-offset-4 hover:underline"
						>
							Test Completo
						</Link>
					</div>

					{/* Información del proyecto */}
					<div className="text-xs text-muted-foreground/80 space-y-1">
						<p>
							Sistema de gestión financiera personal
						</p>
						<p>
							Desarrollado con Next.js, TypeScript y Tailwind CSS
						</p>
					</div>
				</div>
			</div>
		</div>
	)
} 