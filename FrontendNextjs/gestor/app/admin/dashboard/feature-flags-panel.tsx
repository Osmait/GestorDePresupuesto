'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { UserResponse } from '@/types/user'

const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://127.0.0.1:8080'

interface FeatureItem {
	key: string
	name: string
	description: string
	scope: string
	default_enabled: boolean
	enabled: boolean
	has_override: boolean
	has_global_override: boolean
	global_enabled?: boolean
	user_override_enabled?: boolean
	source?: 'global' | 'user' | 'default'
	blocked_by_global?: boolean
}

interface FeatureFlagsPanelProps {
	users: UserResponse[]
	token: string
}

export function FeatureFlagsPanel({ users, token }: FeatureFlagsPanelProps) {
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
			const response = await fetch(`${BASE_URL}/admin/features`, {
				headers: { Authorization: `Bearer ${token}` },
			})
			if (!response.ok) {
				throw new Error(`failed: ${response.status}`)
			}
			const data = await response.json()
			setCatalogFeatures(data?.data || [])
			setPendingGlobal({})
		} catch (error: any) {
			toast.error(`Error loading feature catalog: ${error.message}`)
		} finally {
			setIsLoading(false)
		}
	}, [token])

	const loadUserFlags = useCallback(
		async (userID: string) => {
			if (!userID) {
				setFeatures([])
				setPending({})
				return
			}

			setIsLoading(true)
			try {
				const response = await fetch(`${BASE_URL}/admin/users/${userID}/features`, {
					headers: { Authorization: `Bearer ${token}` },
				})
				if (!response.ok) {
					throw new Error(`failed: ${response.status}`)
				}
				const data = await response.json()
				setFeatures(data?.data || [])
				setPending({})
			} catch (error: any) {
				toast.error(`Error loading feature flags: ${error.message}`)
			} finally {
				setIsLoading(false)
			}
		},
		[token],
	)

	useEffect(() => {
		void loadCatalog()
	}, [loadCatalog])

	useEffect(() => {
		const timeout = setTimeout(async () => {
			setIsSearchingUsers(true)
			try {
				const params = new URLSearchParams()
				params.set('limit', '25')
				if (userSearch.trim().length >= 2) {
					params.set('q', userSearch.trim())
				}

				const response = await fetch(`${BASE_URL}/users?${params.toString()}`, {
					headers: { Authorization: `Bearer ${token}` },
				})
				if (!response.ok) {
					throw new Error(`failed: ${response.status}`)
				}

				const data = await response.json()
				setAvailableUsers(data || [])
			} catch (error: any) {
				toast.error(`Error searching users: ${error.message}`)
			} finally {
				setIsSearchingUsers(false)
			}
		}, 350)

		return () => clearTimeout(timeout)
	}, [userSearch, token])

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

			const response = await fetch(`${BASE_URL}/admin/users/${selectedUserId}/features`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify({ overrides }),
			})

			if (!response.ok) {
				throw new Error(`failed: ${response.status}`)
			}

			toast.success('Feature flags updated')
			await loadUserFlags(selectedUserId)
		} catch (error: any) {
			toast.error(`Error saving feature flags: ${error.message}`)
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
				const response = await fetch(`${BASE_URL}/admin/features/${featureKey}/global`, {
					method: 'PATCH',
					headers: {
						'Content-Type': 'application/json',
						Authorization: `Bearer ${token}`,
					},
					body: JSON.stringify({ enabled, reason: 'admin global toggle' }),
				})
				if (!response.ok) {
					throw new Error(`failed: ${response.status}`)
				}
			}

			toast.success('Global feature overrides updated')
			await loadCatalog()
			if (selectedUserId) {
				await loadUserFlags(selectedUserId)
			}
		} catch (error: any) {
			toast.error(`Error saving global feature overrides: ${error.message}`)
		} finally {
			setIsSaving(false)
		}
	}

	const resetGlobalOverride = async (featureKey: string) => {
		try {
			const response = await fetch(`${BASE_URL}/admin/features/${featureKey}/global`, {
				method: 'DELETE',
				headers: { Authorization: `Bearer ${token}` },
			})
			if (!response.ok) {
				throw new Error(`failed: ${response.status}`)
			}

			toast.success(`Reset global override for ${featureKey}`)
			await loadCatalog()
			if (selectedUserId) {
				await loadUserFlags(selectedUserId)
			}
		} catch (error: any) {
			toast.error(`Error resetting global override: ${error.message}`)
		}
	}

	const resetOverride = async (featureKey: string) => {
		if (!selectedUserId) {
			return
		}

		try {
			const response = await fetch(`${BASE_URL}/admin/users/${selectedUserId}/features/${featureKey}`, {
				method: 'DELETE',
				headers: { Authorization: `Bearer ${token}` },
			})
			if (!response.ok) {
				throw new Error(`failed: ${response.status}`)
			}

			toast.success(`Reset ${featureKey} to default`)
			await loadUserFlags(selectedUserId)
		} catch (error: any) {
			toast.error(`Error resetting override: ${error.message}`)
		}
	}

	return (
		<Card className='border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden'>
			<CardHeader>
				<CardTitle>Feature Flags by User</CardTitle>
				<CardDescription>Enable or disable features per user account.</CardDescription>
			</CardHeader>
			<CardContent className='space-y-4'>
				<div className='space-y-2'>
					<div className='text-sm font-medium'>Global Overrides</div>
					{catalogFeatures.map((feature) => (
						<div key={`global-${feature.key}`} className='rounded border p-3 flex items-center justify-between gap-3'>
							<div className='min-w-0'>
								<div className='text-sm font-medium'>{feature.name}</div>
								<div className='text-xs text-muted-foreground truncate'>{feature.description || feature.key}</div>
								<div className='text-[11px] text-muted-foreground mt-1'>
									default: {feature.default_enabled ? 'ON' : 'OFF'} | global override:{' '}
									{feature.has_global_override ? 'YES' : 'NO'}
								</div>
							</div>
							<div className='flex items-center gap-2'>
								<Switch
									checked={feature.has_global_override ? !!feature.global_enabled : feature.default_enabled}
									onCheckedChange={(value) => handleGlobalToggle(feature.key, value)}
								/>
								<Button
									size='sm'
									variant='outline'
									onClick={() => resetGlobalOverride(feature.key)}
									disabled={!feature.has_global_override}
								>
									Reset Global
								</Button>
							</div>
						</div>
					))}
					<div className='flex justify-end'>
						<Button onClick={saveGlobalChanges} disabled={isSaving || Object.keys(pendingGlobal).length === 0}>
							{isSaving ? 'Saving...' : `Save ${Object.keys(pendingGlobal).length} global changes`}
						</Button>
					</div>
				</div>

				<div className='border-t pt-4' />

				<div className='max-w-md'>
					<Input
						value={userSearch}
						onChange={(e) => setUserSearch(e.target.value)}
						placeholder='Buscar usuario por nombre o email'
					/>
				</div>

				<div className='max-w-3xl rounded border bg-background/50 overflow-hidden'>
					<div className='max-h-64 overflow-y-auto'>
						<table className='w-full text-sm'>
							<thead className='sticky top-0 bg-background border-b'>
								<tr className='text-left text-xs text-muted-foreground'>
									<th className='px-3 py-2 font-medium'>Nombre</th>
									<th className='px-3 py-2 font-medium'>Email</th>
									<th className='px-3 py-2 font-medium w-28'>Seleccionar</th>
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
											<td className='px-3 py-2 text-muted-foreground'>{user.email}</td>
											<td className='px-3 py-2'>
												<Button
													size='sm'
													variant={isSelected ? 'default' : 'outline'}
													onClick={() => setSelectedUserId(user.id)}
												>
													{isSelected ? 'Activo' : 'Elegir'}
												</Button>
											</td>
										</tr>
									)
								})}
								{!isSearchingUsers && usersForSelect.length === 0 && (
									<tr>
										<td colSpan={3} className='px-3 py-3 text-sm text-muted-foreground'>
											No se encontraron usuarios
										</td>
									</tr>
								)}
							</tbody>
						</table>
					</div>
					{isSearchingUsers && (
						<div className='px-3 py-2 text-xs text-muted-foreground border-t'>Buscando usuarios...</div>
					)}
				</div>

				{selectedUser && (
					<div className='text-sm text-muted-foreground'>
						Managing flags for:{' '}
						<span className='font-medium text-foreground'>
							{selectedUser.name} {selectedUser.last_name}
						</span>
					</div>
				)}

				<div className='space-y-2'>
					{isLoading && <div className='text-sm text-muted-foreground'>Loading feature flags...</div>}
					{!isLoading && selectedUserId && features.length === 0 && (
						<div className='text-sm text-muted-foreground'>No feature flags found.</div>
					)}

					{features.map((feature) => (
						<div key={feature.key} className='rounded border p-3 flex items-center justify-between gap-3'>
							<div className='min-w-0'>
								<div className='text-sm font-medium'>{feature.name}</div>
								<div className='text-xs text-muted-foreground truncate'>{feature.description || feature.key}</div>
								<div className='text-[11px] text-muted-foreground mt-1'>
									default: {feature.default_enabled ? 'ON' : 'OFF'} | user override:{' '}
									{feature.has_override ? 'YES' : 'NO'} | source: {feature.source || 'default'}
								</div>
								{feature.blocked_by_global && (
									<div className='text-[11px] text-amber-600 mt-1'>Overridden by global setting</div>
								)}
							</div>
							<div className='flex items-center gap-2'>
								<Switch
									checked={pending[feature.key] ?? feature.user_override_enabled ?? feature.enabled}
									onCheckedChange={(value) => handleToggle(feature.key, value)}
								/>
								<Button size='sm' variant='outline' onClick={() => resetOverride(feature.key)}>
									Reset
								</Button>
							</div>
						</div>
					))}
				</div>

				<div className='flex justify-end'>
					<Button onClick={saveChanges} disabled={isSaving || Object.keys(pending).length === 0}>
						{isSaving ? 'Saving...' : `Save ${Object.keys(pending).length} changes`}
					</Button>
				</div>
			</CardContent>
		</Card>
	)
}
