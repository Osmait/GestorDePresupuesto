'use client'

import { Clock, Loader2, LogIn, Play, UserPlus } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { AuthRepository } from '@/app/repository/authRepository'
import { LanguageSwitcher } from '@/components/common/LanguageSwitcher'
import { ModeToggle } from '@/components/common/ToggleMode'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SESSION_EXPIRED_REASON } from '@/lib/auth/callback-url'
import { LoginForm } from './login-form'
import { RegisterForm } from './register-form'

interface AuthContainerProps {
	initialMode?: 'login' | 'register'
}

export function AuthContainer({ initialMode = 'login' }: AuthContainerProps) {
	const t = useTranslations('auth')
	const tCommon = useTranslations('common')
	const [mode, setMode] = useState<'login' | 'register'>(initialMode)
	const [isLoading, setIsLoading] = useState(false)
	const [sessionExpired, setSessionExpired] = useState(false)
	const router = useRouter()
	const authRepo = new AuthRepository()
	const isDevelopment = process.env.NODE_ENV === 'development'

	// `/login?reason=session_expired` comes from the session-expired sign-out.
	// Read from window.location (not useSearchParams) so the page stays static.
	useEffect(() => {
		if (new URLSearchParams(window.location.search).get('reason') === SESSION_EXPIRED_REASON) {
			setSessionExpired(true)
			setMode('login')
		}
	}, [])

	const toggleMode = () => {
		setMode(mode === 'login' ? 'register' : 'login')
	}

	const handleDemoLogin = async () => {
		try {
			setIsLoading(true)
			// 1. Get Demo Token from Backend
			const token = await authRepo.createDemoUser()

			// 2. Sign in with NextAuth using the token
			const result = await signIn('credentials', {
				demoToken: token,
				redirect: false,
			})

			if (result?.error) {
				toast.error(t('demo.loginError'))
				return
			}

			toast.success(t('demo.welcome'))
			router.push('/app')
		} catch (error) {
			console.error(error)
			toast.error(t('demo.error'))
		} finally {
			setIsLoading(false)
		}
	}

	return (
		<div className='flex min-h-screen items-center justify-center bg-background p-4'>
			<Tabs
				value={mode}
				onValueChange={(value) => setMode(value as 'login' | 'register')}
				className='w-full max-w-md space-y-8'
			>
				<div className='space-y-6 text-center'>
					{/* Logo y título de la aplicación */}
					<div className='flex items-center justify-center'>
						<Link href='/' className='flex items-center gap-3 rounded-lg'>
							<div className='flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl border border-border bg-background'>
								<Image
									src='/sbfinance-logo.webp'
									alt='SBFinance logo'
									width={48}
									height={48}
									className='h-full w-full object-cover'
								/>
							</div>
							<div className='text-left'>
								<h1 className='text-2xl font-bold text-foreground'>SBFinance</h1>
								<p className='text-sm text-muted-foreground'>{tCommon('appTagline')}</p>
							</div>
						</Link>
					</div>

					{/* Login / register switch */}
					<div className='flex flex-col items-center justify-center gap-4'>
						<TabsList aria-label={t('container.modeLabel')} className='h-auto'>
							<TabsTrigger value='login' className='gap-2 px-6 py-2'>
								<LogIn className='h-4 w-4' aria-hidden='true' />
								{t('container.login')}
							</TabsTrigger>
							<TabsTrigger value='register' className='gap-2 px-6 py-2'>
								<UserPlus className='h-4 w-4' aria-hidden='true' />
								{t('container.register')}
							</TabsTrigger>
						</TabsList>

						<Button
							type='button'
							variant='ghost'
							onClick={handleDemoLogin}
							disabled={isLoading}
							aria-busy={isLoading || undefined}
						>
							{isLoading ? (
								<Loader2 className='mr-2 h-4 w-4 animate-spin' aria-hidden='true' />
							) : (
								<Play className='mr-2 h-4 w-4' aria-hidden='true' />
							)}
							{t('demo.tryDemo')}
						</Button>
					</div>

					<div className='flex items-center justify-center gap-2'>
						{isDevelopment && (
							<Badge variant='outline' className='text-xs'>
								{t('container.devMode')}
							</Badge>
						)}
						<ModeToggle />
						<LanguageSwitcher />
					</div>
				</div>

				{sessionExpired && mode === 'login' && (
					<Alert role='status'>
						<Clock className='h-4 w-4' aria-hidden='true' />
						<AlertDescription>{t('login.sessionExpired')}</AlertDescription>
					</Alert>
				)}

				<TabsContent value='login' className='mt-0'>
					<LoginForm onToggleForm={toggleMode} showToggle={false} />
				</TabsContent>
				<TabsContent value='register' className='mt-0'>
					<RegisterForm onToggleForm={toggleMode} showToggle={false} />
				</TabsContent>

				<div className='space-y-1 text-center text-xs text-muted-foreground'>
					<p>{t('container.description')}</p>
					<p>{t('container.tech')}</p>
				</div>
			</Tabs>
		</div>
	)
}
