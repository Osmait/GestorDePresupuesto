'use client'

import { RefreshCw, Trash2, Users } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAdmin } from '@/hooks/useAdmin'
import { getAdminRepository } from '@/lib/repositoryConfig'
import { UserResponse } from '@/types/user'
import { CreateUserModal } from './create-user-modal'
import { FeatureFlagsPanel } from './feature-flags-panel'
import { EditableUserTable } from './user-table'

export default function AdminDashboard() {
	const t = useTranslations('admin')
	const { isAdmin, isLoading: isAdminLoading } = useAdmin()
	const router = useRouter()
	const [users, setUsers] = useState<UserResponse[]>([])
	const [isLoadingUsers, setIsLoadingUsers] = useState(true)
	const [isCleaning, setIsCleaning] = useState(false)
	const [isSaving, setIsSaving] = useState(false)

	const fetchUsers = useCallback(async () => {
		setIsLoadingUsers(true)
		try {
			setUsers(await getAdminRepository().listUsers())
		} catch (error: any) {
			toast.error(t('toasts.loadUsersError', { message: error.message }))
		} finally {
			setIsLoadingUsers(false)
		}
	}, [t])

	useEffect(() => {
		if (!isAdminLoading && !isAdmin) {
			router.push('/app')
		} else if (isAdmin) {
			fetchUsers()
		}
	}, [isAdmin, isAdminLoading, router, fetchUsers])

	const handleSave = async (updatedUsers: UserResponse[]) => {
		setIsSaving(true)
		try {
			await getAdminRepository().updateUsers(updatedUsers)

			toast.success(t('toasts.saveSuccess', { count: updatedUsers.length }))
			fetchUsers()
		} catch (error: any) {
			toast.error(t('toasts.saveError', { message: error.message }))
		} finally {
			setIsSaving(false)
		}
	}

	const handleDelete = async (userId: string) => {
		try {
			await getAdminRepository().deleteUser(userId)

			toast.success(t('toasts.disableSuccess'))
			fetchUsers()
		} catch (error: any) {
			toast.error(t('toasts.disableError', { message: error.message }))
		}
	}

	const handleCleanup = async () => {
		if (!confirm(t('confirmCleanup'))) return

		setIsCleaning(true)
		try {
			await getAdminRepository().cleanupDemoUsers()

			toast.success(t('toasts.cleanupSuccess'))
			fetchUsers() // Refresh the list
		} catch (error: any) {
			toast.error(t('toasts.cleanupError', { message: error.message }))
		} finally {
			setIsCleaning(false)
		}
	}

	if (isAdminLoading || !isAdmin) {
		return (
			<div className='flex h-[calc(100vh-4rem)] items-center justify-center'>
				<div className='text-center'>
					<RefreshCw className='h-8 w-8 animate-spin mx-auto mb-4 text-primary' />
					<p className='text-muted-foreground'>{t('checkingAccess')}</p>
				</div>
			</div>
		)
	}

	return (
		<div className='flex-1 space-y-4 sm:space-y-6 p-4 sm:p-8 pt-4 sm:pt-6 bg-background/50 overflow-x-hidden'>
			<div className='flex flex-col sm:flex-row sm:items-center justify-between gap-4'>
				<div className='min-w-0'>
					<h2 className='text-2xl sm:text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent truncate'>
						{t('title')}
					</h2>
					<p className='text-sm text-muted-foreground'>{t('subtitle')}</p>
				</div>
				<div className='flex items-center gap-2 w-full sm:w-auto'>
					<CreateUserModal onUserCreated={fetchUsers} />
					<Button
						variant='outline'
						size='sm'
						onClick={fetchUsers}
						disabled={isLoadingUsers || isSaving}
						className='gap-2 flex-1 sm:flex-none'
						aria-label={t('refresh')}
					>
						<RefreshCw className={`h-4 w-4 ${isLoadingUsers || isSaving ? 'animate-spin' : ''}`} />
						<span className='hidden sm:inline'>{t('refresh')}</span>
					</Button>
					<Button
						variant='destructive'
						size='sm'
						onClick={handleCleanup}
						disabled={isCleaning || isSaving}
						className='gap-2 flex-1 sm:flex-none'
						aria-label={t('cleanDemos')}
					>
						<Trash2 className='h-4 w-4' />
						<span className='hidden sm:inline'>{isCleaning ? t('cleaning') : t('cleanDemos')}</span>
					</Button>
				</div>
			</div>

			<div className='grid gap-4 sm:gap-6'>
				<Card className='border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden'>
					<CardHeader className='flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-4 sm:p-6'>
						<div className='min-w-0'>
							<CardTitle className='flex items-center gap-2 text-base sm:text-lg'>
								<Users className='h-4 w-4 sm:h-5 sm:w-5 text-primary flex-shrink-0' />
								{t('users.title')}
							</CardTitle>
							<CardDescription className='text-xs sm:text-sm'>{t('users.description')}</CardDescription>
						</div>
						<Badge variant='secondary' className='font-mono self-start sm:self-auto'>
							{t('users.total', { count: users.length })}
						</Badge>
					</CardHeader>
					<CardContent className='p-4 sm:p-6 pt-0'>
						<EditableUserTable users={users} onSave={handleSave} onDelete={handleDelete} isLoading={isLoadingUsers} />
					</CardContent>
				</Card>

				<FeatureFlagsPanel users={users} />
			</div>
		</div>
	)
}
