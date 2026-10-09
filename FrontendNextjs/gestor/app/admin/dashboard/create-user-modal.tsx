'use client'

import { Eye, EyeOff, Loader2, UserPlus } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { getAdminRepository } from '@/lib/repositoryConfig'
import { CreateUserRequest } from '@/types/user'

interface CreateUserModalProps {
	onUserCreated: () => void
}

export function CreateUserModal({ onUserCreated }: CreateUserModalProps) {
	const t = useTranslations('admin.createUser')
	const tRoles = useTranslations('admin.roles')
	const [isOpen, setIsOpen] = useState(false)
	const [isLoading, setIsLoading] = useState(false)
	const [showPassword, setShowPassword] = useState(false)
	const [formData, setFormData] = useState<CreateUserRequest>({
		name: '',
		last_name: '',
		email: '',
		password: '',
		role: 'USER',
	})
	const [errors, setErrors] = useState<Partial<Record<keyof CreateUserRequest, string>>>({})

	const validateForm = (): boolean => {
		const newErrors: Partial<Record<keyof CreateUserRequest, string>> = {}

		if (!formData.name || formData.name.length < 2) {
			newErrors.name = t('errors.name')
		}
		if (!formData.last_name || formData.last_name.length < 2) {
			newErrors.last_name = t('errors.lastName')
		}
		if (!formData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
			newErrors.email = t('errors.email')
		}
		if (!formData.password || formData.password.length < 8) {
			newErrors.password = t('errors.password')
		}

		setErrors(newErrors)
		return Object.keys(newErrors).length === 0
	}

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()

		if (!validateForm()) {
			return
		}

		setIsLoading(true)
		try {
			await getAdminRepository().createUser(formData)

			toast.success(t('success', { name: `${formData.name} ${formData.last_name}` }))
			setIsOpen(false)
			resetForm()
			onUserCreated()
		} catch (error: any) {
			toast.error(t('error', { message: error.message }))
		} finally {
			setIsLoading(false)
		}
	}

	const resetForm = () => {
		setFormData({
			name: '',
			last_name: '',
			email: '',
			password: '',
			role: 'USER',
		})
		setErrors({})
		setShowPassword(false)
	}

	const handleOpenChange = (open: boolean) => {
		setIsOpen(open)
		if (!open) {
			resetForm()
		}
	}

	return (
		<Dialog open={isOpen} onOpenChange={handleOpenChange}>
			<DialogTrigger asChild>
				<Button size='sm' className='gap-2 flex-1 sm:flex-none' aria-label={t('trigger')}>
					<UserPlus className='h-4 w-4' />
					<span className='hidden sm:inline'>{t('trigger')}</span>
				</Button>
			</DialogTrigger>
			<DialogContent className='sm:max-w-md'>
				<DialogHeader>
					<DialogTitle className='flex items-center gap-2'>
						<UserPlus className='h-5 w-5 text-primary' />
						{t('title')}
					</DialogTitle>
					<DialogDescription>{t('description')}</DialogDescription>
				</DialogHeader>

				<form onSubmit={handleSubmit} className='space-y-4 mt-4'>
					<div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
						<div className='space-y-2'>
							<Label htmlFor='name'>{t('firstName')}</Label>
							<Input
								id='name'
								placeholder={t('firstNamePlaceholder')}
								value={formData.name}
								onChange={(e) => setFormData({ ...formData, name: e.target.value })}
								className={errors.name ? 'border-destructive' : ''}
								disabled={isLoading}
							/>
							{errors.name && <p className='text-xs text-destructive'>{errors.name}</p>}
						</div>
						<div className='space-y-2'>
							<Label htmlFor='last_name'>{t('lastName')}</Label>
							<Input
								id='last_name'
								placeholder={t('lastNamePlaceholder')}
								value={formData.last_name}
								onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
								className={errors.last_name ? 'border-destructive' : ''}
								disabled={isLoading}
							/>
							{errors.last_name && <p className='text-xs text-destructive'>{errors.last_name}</p>}
						</div>
					</div>

					<div className='space-y-2'>
						<Label htmlFor='email'>{t('email')}</Label>
						<Input
							id='email'
							type='email'
							placeholder={t('emailPlaceholder')}
							value={formData.email}
							onChange={(e) => setFormData({ ...formData, email: e.target.value })}
							className={errors.email ? 'border-destructive' : ''}
							disabled={isLoading}
						/>
						{errors.email && <p className='text-xs text-destructive'>{errors.email}</p>}
					</div>

					<div className='space-y-2'>
						<Label htmlFor='password'>{t('password')}</Label>
						<div className='relative'>
							<Input
								id='password'
								type={showPassword ? 'text' : 'password'}
								placeholder={t('passwordPlaceholder')}
								value={formData.password}
								onChange={(e) => setFormData({ ...formData, password: e.target.value })}
								className={`pr-10 ${errors.password ? 'border-destructive' : ''}`}
								disabled={isLoading}
							/>
							<Button
								type='button'
								variant='ghost'
								size='sm'
								className='absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent'
								onClick={() => setShowPassword(!showPassword)}
								aria-label={showPassword ? t('hidePassword') : t('showPassword')}
								disabled={isLoading}
							>
								{showPassword ? (
									<EyeOff className='h-4 w-4 text-muted-foreground' />
								) : (
									<Eye className='h-4 w-4 text-muted-foreground' />
								)}
							</Button>
						</div>
						{errors.password && <p className='text-xs text-destructive'>{errors.password}</p>}
					</div>

					<div className='space-y-2'>
						<Label htmlFor='role'>{t('role')}</Label>
						<Select
							value={formData.role}
							onValueChange={(value: 'USER' | 'ADMIN') => setFormData({ ...formData, role: value })}
							disabled={isLoading}
						>
							<SelectTrigger id='role'>
								<SelectValue placeholder={t('selectRole')} />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value='USER'>{tRoles('USER')}</SelectItem>
								<SelectItem value='ADMIN'>{tRoles('ADMIN')}</SelectItem>
							</SelectContent>
						</Select>
					</div>

					<DialogFooter className='mt-6'>
						<Button type='button' variant='outline' onClick={() => handleOpenChange(false)} disabled={isLoading}>
							{t('cancel')}
						</Button>
						<Button type='submit' disabled={isLoading} className='gap-2'>
							{isLoading ? (
								<>
									<Loader2 className='h-4 w-4 animate-spin' />
									{t('creating')}
								</>
							) : (
								<>
									<UserPlus className='h-4 w-4' />
									{t('submit')}
								</>
							)}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	)
}
