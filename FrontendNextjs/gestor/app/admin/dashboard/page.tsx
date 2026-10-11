'use client'

import { Loader2, RefreshCw, Trash2, Users } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { PageHeader } from '@/components/shared/PageHeader'
import { PageShell } from '@/components/shared/PageShell'
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
	const [cleanupOpen, setCleanupOpen] = useState(false)

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
			<div className='flex h-[calc(100vh-4rem)] items-center justify-center' role='status'>
				<div className='text-center'>
					<Loader2 className='mx-auto mb-4 h-8 w-8 animate-spin text-muted-foreground' aria-hidden='true' />
					<p className='text-muted-foreground'>{t('checkingAccess')}</p>
				</div>
			</div>
		)
	}

	const busy = isLoadingUsers || isSaving

	return (
		<PageShell>
			<PageHeader
				title={t('title')}
				description={t('subtitle')}
				actions={
					<>
						<Button variant='outline' onClick={fetchUsers} disabled={busy}>
							<RefreshCw className={`mr-2 h-4 w-4 ${busy ? 'animate-spin' : ''}`} aria-hidden='true' />
							{t('refresh')}
						</Button>
						<Button variant='outline' onClick={() => setCleanupOpen(true)} disabled={isCleaning || isSaving}>
							<Trash2 className='mr-2 h-4 w-4' aria-hidden='true' />
							{t('cleanDemos')}
						</Button>
						<CreateUserModal onUserCreated={fetchUsers} />
					</>
				}
			/>

			<Card className='overflow-hidden'>
				<CardHeader className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
					<div className='min-w-0 space-y-1.5'>
						<CardTitle className='flex items-center gap-2 text-lg'>
							<Users className='h-5 w-5 shrink-0 text-muted-foreground' aria-hidden='true' />
							{t('users.title')}
						</CardTitle>
						<CardDescription>{t('users.description')}</CardDescription>
					</div>
					<Badge variant='secondary' className='self-start tabular-nums sm:self-auto'>
						{t('users.total', { count: users.length })}
					</Badge>
				</CardHeader>
				<CardContent>
					<EditableUserTable users={users} onSave={handleSave} onDelete={handleDelete} isLoading={isLoadingUsers} />
				</CardContent>
			</Card>

			<FeatureFlagsPanel users={users} />

			<ConfirmDialog
				open={cleanupOpen}
				onOpenChange={setCleanupOpen}
				title={t('cleanupTitle')}
				description={t('confirmCleanup')}
				confirmLabel={t('cleanDemos')}
				destructive
				loading={isCleaning}
				onConfirm={handleCleanup}
			/>
		</PageShell>
	)
}
