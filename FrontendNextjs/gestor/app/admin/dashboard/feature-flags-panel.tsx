'use client'

import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import type { AdminFeatureItem } from '@/app/repository/adminRepository'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { getAdminRepository } from '@/lib/repositoryConfig'
import { UserResponse } from '@/types/user'

type FeatureItem = AdminFeatureItem

interface FeatureFlagsPanelProps {
	users: UserResponse[]
}

export function FeatureFlagsPanel({ users }: FeatureFlagsPanelProps) {
	const t = useTranslations('admin.flags')
	const onOff = (value: boolean) => (value ? t('on') : t('off'))
	const yesNo = (value: boolean) => (value ? t('yes') : t('no'))
	const sourceLabel = (source?: string) =>
		source === 'global' || source === 'user' || source === 'default'
			? t(`sources.${source}`)
			: (source ?? t('sources.default'))
	const [selectedUserId, setSelectedUserId] = useState('')
	const [userSearch, setUserSearch] = useState('')
	const [availableUsers, setAvailableUsers] = useState<UserResponse[]>(users)
	const [isSearchingUsers, setIsSearchingUsers] = useState(false)
	const [features, setFeatures] = useState<FeatureItem[]>([])
	const [catalogFeatures, setCatalogFeatures] = useState<FeatureItem[]>([])
	const [pending, setPending] = useState<Record<string, boolean>>({})
	const [pendingGlobal, setPendingGlobal] = useState<Record<string, boolean>>({})
	const [isLoading, setIsLoading] = useState(false)
	const [isSaving, setIsSaving] = useState(false)

	const selectedUser = useMemo(
		() => [...users, ...availableUsers].find((user) => user.id === selectedUserId),
		[users, availableUsers, selectedUserId],
	)

	const usersForSelect = useMemo(() => {
		if (!selectedUser) {
			return availableUsers
		}
		if (availableUsers.some((user) => user.id === selectedUser.id)) {
			return availableUsers
		}
		return [selectedUser, ...availableUsers]
	}, [availableUsers, selectedUser])

	const loadCatalog = useCallback(async () => {
		setIsLoading(true)
		try {
			setCatalogFeatures(await getAdminRepository().getFeatureCatalog())
			setPendingGlobal({})
		} catch (error: any) {
			toast.error(t('toasts.catalogError', { message: error.message }))
		} finally {
			setIsLoading(false)
		}
	}, [t])

	const loadUserFlags = useCallback(
		async (userID: string) => {
			if (!userID) {
				setFeatures([])
				setPending({})
				return
			}

			setIsLoading(true)
			try {
				setFeatures(await getAdminRepository().getUserFeatures(userID))
				setPending({})
			} catch (error: any) {
				toast.error(t('toasts.flagsError', { message: error.message }))
			} finally {
				setIsLoading(false)
			}
		},
		[t],
	)

	useEffect(() => {
		void loadCatalog()
	}, [loadCatalog])

	useEffect(() => {
		const timeout = setTimeout(async () => {
			setIsSearchingUsers(true)
			try {
				const query = userSearch.trim()
				const found = await getAdminRepository().listUsers({
					limit: 25,
					q: query.length >= 2 ? query : undefined,
				})
				setAvailableUsers(found)
			} catch (error: any) {
				toast.error(t('toasts.searchError', { message: error.message }))
			} finally {
				setIsSearchingUsers(false)
			}
		}, 350)

		return () => clearTimeout(timeout)
	}, [userSearch, t])

	useEffect(() => {
		if (selectedUserId) {
			void loadUserFlags(selectedUserId)
		}
	}, [selectedUserId, loadUserFlags])

	const handleToggle = (featureKey: string, value: boolean) => {
		setPending((prev) => ({ ...prev, [featureKey]: value }))
		setFeatures((prev) =>
			prev.map((feature) => {
				if (feature.key !== featureKey) {
					return feature
				}
				return {
					...feature,
					enabled: feature.has_global_override ? feature.enabled : value,
					user_override_enabled: value,
					has_override: true,
					source: feature.has_global_override ? 'global' : 'user',
				}
			}),
		)
	}

	const handleGlobalToggle = (featureKey: string, value: boolean) => {
		setPendingGlobal((prev) => ({ ...prev, [featureKey]: value }))
		setCatalogFeatures((prev) =>
			prev.map((feature) =>
				feature.key === featureKey
					? {
							...feature,
							enabled: value,
							has_global_override: true,
							global_enabled: value,
							source: 'global',
						}
					: feature,
			),
		)
	}

	const saveChanges = async () => {
		if (!selectedUserId || Object.keys(pending).length === 0) {
			return
		}

		setIsSaving(true)
		try {
			const overrides = Object.entries(pending).map(([feature_key, enabled]) => ({
				feature_key,
				enabled,
				reason: 'admin toggle',
			}))

			await getAdminRepository().updateUserFeatures(selectedUserId, overrides)

			toast.success(t('toasts.saveSuccess'))
			await loadUserFlags(selectedUserId)
		} catch (error: any) {
			toast.error(t('toasts.saveError', { message: error.message }))
		} finally {
			setIsSaving(false)
		}
	}

	const saveGlobalChanges = async () => {
		const keys = Object.keys(pendingGlobal)
		if (keys.length === 0) {
			return
		}

		setIsSaving(true)
		try {
			for (const featureKey of keys) {
				const enabled = pendingGlobal[featureKey]
				await getAdminRepository().setGlobalFeature(featureKey, enabled, 'admin global toggle')
			}

			toast.success(t('toasts.globalSuccess'))
			await loadCatalog()
			if (selectedUserId) {
				await loadUserFlags(selectedUserId)
			}
		} catch (error: any) {
			toast.error(t('toasts.globalError', { message: error.message }))
		} finally {
			setIsSaving(false)
		}
	}

	const resetGlobalOverride = async (featureKey: string) => {
		try {
			await getAdminRepository().resetGlobalFeature(featureKey)

			toast.success(t('toasts.resetGlobalSuccess', { key: featureKey }))
			await loadCatalog()
			if (selectedUserId) {
				await loadUserFlags(selectedUserId)
			}
		} catch (error: any) {
			toast.error(t('toasts.resetGlobalError', { message: error.message }))
		}
	}

	const resetOverride = async (featureKey: string) => {
		if (!selectedUserId) {
			return
		}

		try {
			await getAdminRepository().resetUserFeature(selectedUserId, featureKey)

			toast.success(t('toasts.resetSuccess', { key: featureKey }))
			await loadUserFlags(selectedUserId)
		} catch (error: any) {
			toast.error(t('toasts.resetError', { message: error.message }))
		}
	}

	return (
		<Card className='border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden'>
			<CardHeader>
				<CardTitle>{t('title')}</CardTitle>
				<CardDescription>{t('description')}</CardDescription>
			</CardHeader>
			<CardContent className='space-y-4'>
				<div className='space-y-2'>
					<div className='text-sm font-medium'>{t('globalOverrides')}</div>
					{catalogFeatures.map((feature) => (
						<div
							key={`global-${feature.key}`}
							className='rounded border p-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'
						>
							<div className='min-w-0'>
								<div className='text-sm font-medium'>{feature.name}</div>
								<div className='text-xs text-muted-foreground truncate'>{feature.description || feature.key}</div>
								<div className='text-[11px] text-muted-foreground mt-1'>
									{t('globalMeta', {
										defaultState: onOff(feature.default_enabled),
										overrideState: yesNo(feature.has_global_override),
									})}
								</div>
							</div>
							<div className='flex items-center gap-2'>
								<Switch
									checked={feature.has_global_override ? !!feature.global_enabled : feature.default_enabled}
									aria-label={feature.name}
									onCheckedChange={(value) => handleGlobalToggle(feature.key, value)}
								/>
								<Button
									size='sm'
									variant='outline'
									onClick={() => resetGlobalOverride(feature.key)}
									disabled={!feature.has_global_override}
								>
									{t('resetGlobal')}
								</Button>
							</div>
						</div>
					))}
					<div className='flex justify-end'>
						<Button onClick={saveGlobalChanges} disabled={isSaving || Object.keys(pendingGlobal).length === 0}>
							{isSaving ? t('saving') : t('saveGlobal', { count: Object.keys(pendingGlobal).length })}
						</Button>
					</div>
				</div>

				<div className='border-t pt-4' />

				<div className='max-w-md'>
					<Input
						value={userSearch}
						onChange={(e) => setUserSearch(e.target.value)}
						placeholder={t('searchPlaceholder')}
						aria-label={t('searchPlaceholder')}
					/>
				</div>

				<div className='max-w-3xl rounded border bg-background/50 overflow-hidden'>
					<div className='max-h-64 overflow-y-auto'>
						<table className='w-full text-sm'>
							<thead className='sticky top-0 bg-background border-b'>
								<tr className='text-left text-xs text-muted-foreground'>
									<th className='px-3 py-2 font-medium'>{t('columns.name')}</th>
									<th className='px-3 py-2 font-medium'>{t('columns.email')}</th>
									<th className='px-3 py-2 font-medium w-28'>{t('columns.select')}</th>
								</tr>
							</thead>
							<tbody>
								{usersForSelect.map((user) => {
									const isSelected = selectedUserId === user.id
									return (
										<tr
											key={user.id}
											className={`border-b last:border-b-0 ${isSelected ? 'bg-primary/10' : 'hover:bg-muted/40'}`}
										>
											<td className='px-3 py-2 font-medium'>
												{user.name} {user.last_name}
											</td>
											<td className='px-3 py-2 text-muted-foreground break-all'>{user.email}</td>
											<td className='px-3 py-2'>
												<Button
													size='sm'
													variant={isSelected ? 'default' : 'outline'}
													onClick={() => setSelectedUserId(user.id)}
												>
													{isSelected ? t('selected') : t('choose')}
												</Button>
											</td>
										</tr>
									)
								})}
								{!isSearchingUsers && usersForSelect.length === 0 && (
									<tr>
										<td colSpan={3} className='px-3 py-3 text-sm text-muted-foreground'>
											{t('noUsers')}
										</td>
									</tr>
								)}
							</tbody>
						</table>
					</div>
					{isSearchingUsers && (
						<div className='px-3 py-2 text-xs text-muted-foreground border-t'>{t('searchingUsers')}</div>
					)}
				</div>

				{selectedUser && (
					<div className='text-sm text-muted-foreground'>
						{t('managingFor')}{' '}
						<span className='font-medium text-foreground'>
							{selectedUser.name} {selectedUser.last_name}
						</span>
					</div>
				)}

				<div className='space-y-2'>
					{isLoading && <div className='text-sm text-muted-foreground'>{t('loadingFlags')}</div>}
					{!isLoading && selectedUserId && features.length === 0 && (
						<div className='text-sm text-muted-foreground'>{t('noFlags')}</div>
					)}

					{features.map((feature) => (
						<div
							key={feature.key}
							className='rounded border p-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'
						>
							<div className='min-w-0'>
								<div className='text-sm font-medium'>{feature.name}</div>
								<div className='text-xs text-muted-foreground truncate'>{feature.description || feature.key}</div>
								<div className='text-[11px] text-muted-foreground mt-1'>
									{t('userMeta', {
										defaultState: onOff(feature.default_enabled),
										overrideState: yesNo(!!feature.has_override),
										source: sourceLabel(feature.source),
									})}
								</div>
								{feature.blocked_by_global && (
									<div className='text-[11px] text-amber-600 mt-1'>{t('blockedByGlobal')}</div>
								)}
							</div>
							<div className='flex items-center gap-2'>
								<Switch
									checked={pending[feature.key] ?? feature.user_override_enabled ?? feature.enabled}
									onCheckedChange={(value) => handleToggle(feature.key, value)}
									aria-label={feature.name}
								/>
								<Button size='sm' variant='outline' onClick={() => resetOverride(feature.key)}>
									{t('reset')}
								</Button>
							</div>
						</div>
					))}
				</div>

				<div className='flex justify-end'>
					<Button onClick={saveChanges} disabled={isSaving || Object.keys(pending).length === 0}>
						{isSaving ? t('saving') : t('saveChanges', { count: Object.keys(pending).length })}
					</Button>
				</div>
			</CardContent>
		</Card>
	)
}
