'use client'

import { useState } from 'react'
import { LoginForm } from './login-form'
import { RegisterForm } from './register-form'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ModeToggle } from '@/components/common/ToggleMode'
import { Home, LogIn, UserPlus, Play, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AuthRepository } from '@/app/repository/authRepository'
import { toast } from 'sonner'
import { signIn } from 'next-auth/react'

interface AuthContainerProps {
	initialMode?: 'login' | 'register'
}

export function AuthContainer({ initialMode = 'login' }: AuthContainerProps) {
	const [mode, setMode] = useState<'login' | 'register'>(initialMode)
	const [isLoading, setIsLoading] = useState(false)
	const router = useRouter()
	const authRepo = new AuthRepository()

	const toggleMode = () => {
		setMode(mode === 'login' ? 'register' : 'login')
	}

	const handleDemoLogin = async () => {
		try {
			setIsLoading(true)
			// 1. Get Demo Token from Backend
			const token = await authRepo.createDemoUser() // Renamed for clarity in next step, or keep demoLogin but make it return token

			// 2. Sign in with NextAuth using the token
			const result = await signIn("credentials", {
				demoToken: token,
				redirect: false,
			})

			if (result?.error) {
				toast.error("Error iniciando sesión demo")
				return
			}

			toast.success("¡Bienvenido al modo Demo! 🎮")
			router.push('/app')
		} catch (error) {
			console.error(error)
			toast.error("Error al iniciar modo demo")
		} finally {
			setIsLoading(false)
		}
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
								<h1 className="text-2xl font-bold text-foreground">
									FinanceApp
								</h1>
								<p className="text-sm text-muted-foreground">Gestor Personal</p>
							</div>
						</Link>
					</div>

					{/* Tabs de navegación */}
					<div className="flex flex-col items-center justify-center gap-4">
						<Card className="p-1 bg-muted/30 border-border/50">
							<div className="flex rounded-lg">
								<button
									onClick={() => setMode('login')}
									className={`flex items-center gap-2 px-6 py-2 rounded-md text-sm font-medium transition-all duration-200 ${mode === 'login'
										? 'bg-background text-foreground shadow-sm border border-border/50'
										: 'text-muted-foreground hover:text-foreground hover:bg-background/50'
										}`}
								>
									<LogIn className="h-4 w-4" />
									Iniciar Sesión
								</button>
								<button
									onClick={() => setMode('register')}
									className={`flex items-center gap-2 px-6 py-2 rounded-md text-sm font-medium transition-all duration-200 ${mode === 'register'
										? 'bg-background text-foreground shadow-sm border border-border/50'
										: 'text-muted-foreground hover:text-foreground hover:bg-background/50'
										}`}
								>
									<UserPlus className="h-4 w-4" />
									Crear Cuenta
								</button>
							</div>
						</Card>

						<button
							onClick={handleDemoLogin}
							disabled={isLoading}
							className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary hover:text-primary/80 hover:bg-primary/10 rounded-full transition-all duration-200"
						>
							{isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
							Probar Demo Interactiva
						</button>
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
