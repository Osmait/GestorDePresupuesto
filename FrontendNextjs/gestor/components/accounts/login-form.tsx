'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import * as z from 'zod'
import { Eye, EyeOff, Mail, Lock, AlertCircle, Loader2, LogIn } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { Button } from '@/components/ui/button'
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { signIn } from "next-auth/react"

interface LoginFormProps {
	onToggleForm?: () => void
	showToggle?: boolean
}

export function LoginForm({ onToggleForm, showToggle = true }: LoginFormProps) {
	const t = useTranslations('auth.login')
	const [isLoading, setIsLoading] = useState(false)
	const [showPassword, setShowPassword] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const router = useRouter()

	// Schema de validación con Zod (con mensajes traducidos)
	const loginSchema = z.object({
		email: z
			.string()
			.min(1, t('emailRequired'))
			.email(t('emailInvalid')),
		password: z
			.string()
			.min(6, t('passwordMinLength'))
			.max(100, 'Password too long'),
	})

	type LoginFormValues = z.infer<typeof loginSchema>

	const resolveLoginError = (resultError?: string | null, status?: number) => {
		if (resultError === 'CredentialsSignin' || status === 401) {
			return t('invalidCredentials')
		}
		if (resultError === 'AccessDenied' || status === 403) {
			return t('accessDenied')
		}
		if (status && status >= 500) {
			return t('serverError')
		}
		if (resultError) {
			return `${t('error')}: ${resultError}`
		}
		return t('error')
	}

	const form = useForm<LoginFormValues>({
		resolver: zodResolver(loginSchema),
		defaultValues: {
			email: '',
			password: '',
		},
	})

	const onSubmit = async (values: LoginFormValues) => {
		let keepLoading = false
		try {
			setIsLoading(true)
			setError(null)

			const result = await signIn('credentials', {
				email: values.email,
				password: values.password,
				redirect: false,
			})

			if (result?.error) {
				setError(resolveLoginError(result.error, result.status))
				return
			}

			keepLoading = true
			router.push('/app')
			router.refresh()
		} catch (err) {
			setError(err instanceof Error ? err.message : t('networkError'))
		} finally {
			if (!keepLoading) {
				setIsLoading(false)
			}
		}
	}



	return (
		<Card className="relative w-full max-w-md mx-auto shadow-lg border-border/50">
			{isLoading && (
				<div className="absolute inset-0 z-20 rounded-lg bg-background/80 backdrop-blur-[1px] flex items-center justify-center">
					<div className="flex items-center gap-2 text-sm font-medium text-foreground">
						<Loader2 className="h-4 w-4 animate-spin" />
						<span>{t('redirecting')}</span>
					</div>
				</div>
			)}
			<CardHeader className="space-y-1 text-center">
				<div className="flex items-center justify-center mb-4">
					<div className="w-12 h-12 bg-gradient-to-br from-primary to-primary/80 rounded-lg flex items-center justify-center">
						<LogIn className="h-6 w-6 text-primary-foreground" />
					</div>
				</div>
				<CardTitle className="text-2xl font-bold text-center">
					{t('title')}
				</CardTitle>
				<CardDescription className="text-muted-foreground">
					{t('subtitle')}
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
									<FormLabel className="text-sm font-medium">{t('email')}</FormLabel>
									<FormControl>
										<div className="relative">
											<Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
											<Input
												{...field}
												type="email"
												placeholder={t('emailPlaceholder')}
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
									<FormLabel className="text-sm font-medium">{t('password')}</FormLabel>
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
									{t('submitting')}
								</>
							) : (
								<>
									<LogIn className="mr-2 h-4 w-4" />
									{t('submit')}
								</>
							)}
						</Button>
					</form>
				</Form>



				{/* Toggle para registro */}
				{showToggle && onToggleForm && (
					<div className="text-center">
						<p className="text-sm text-muted-foreground">
							{t('noAccount')}{' '}
							<Button
								type="button"
								variant="link"
								className="p-0 h-auto font-semibold text-primary hover:text-primary/80"
								onClick={onToggleForm}
								disabled={isLoading}
							>
								{t('createAccount')}
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
						{t('testSimple')}
					</Link>
					<span>•</span>
					<Link
						href="/debug"
						className="hover:text-primary transition-colors"
					>
						{t('debug')}
					</Link>
				</div>
			</CardContent>
		</Card>
	)
} 
