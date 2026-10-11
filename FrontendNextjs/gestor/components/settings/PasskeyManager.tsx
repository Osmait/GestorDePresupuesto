'use client'

import { startRegistration } from '@simplewebauthn/browser'
import { Fingerprint, Loader2, Plus, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { type PasskeySummary, passkeyRepository } from '@/app/repository/passkeyRepository'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { EmptyState } from '@/components/shared/EmptyState'
import { FormDialog } from '@/components/shared/FormDialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatLocalDate, useAppLocale } from '@/lib/i18n/date-locale'

export function PasskeyManager() {
	const t = useTranslations('settingsModal.passkeys')
	const locale = useAppLocale()
	// Keep `load` stable: `t` may change identity between renders.
	const tRef = useRef(t)
	tRef.current = t
	const [passkeys, setPasskeys] = useState<PasskeySummary[]>([])
	const [loading, setLoading] = useState(true)
	const [addOpen, setAddOpen] = useState(false)
	const [newName, setNewName] = useState('')
	const [registering, setRegistering] = useState(false)
	const [toDelete, setToDelete] = useState<PasskeySummary | null>(null)

	const load = useCallback(async () => {
		setLoading(true)
		try {
			const list = await passkeyRepository.list()
			setPasskeys(list)
		} catch (err) {
			console.error('Failed to load passkeys:', err)
			toast.error(tRef.current('loadError'))
		} finally {
			setLoading(false)
		}
	}, [])

	useEffect(() => {
		load()
	}, [load])

	const handleRegister = async () => {
		if (!newName.trim()) {
			toast.error(t('nameRequired'))
			return
		}
		setRegistering(true)
		try {
			const begin = await passkeyRepository.beginRegistration()
			const options = (begin.options as any)?.publicKey ?? begin.options
			const attestation = await startRegistration(options)
			await passkeyRepository.finishRegistration(begin.session_id, newName.trim(), attestation)
			toast.success(t('registered'))
			setAddOpen(false)
			setNewName('')
			await load()
		} catch (err) {
			const msg = err instanceof Error ? err.message : t('registerError')
			if (msg.toLowerCase().includes('abort') || msg.toLowerCase().includes('cancelled')) {
				return
			}
			console.error('Passkey register error:', err)
			toast.error(msg)
		} finally {
			setRegistering(false)
		}
	}

	// Rejects on failure so the ConfirmDialog stays open for a retry.
	const handleDelete = async (id: string) => {
		try {
			await passkeyRepository.delete(id)
			toast.success(t('removed'))
			setPasskeys((prev) => prev.filter((p) => p.id !== id))
		} catch (err) {
			console.error('Passkey delete error:', err)
			toast.error(t('removeError'))
			throw err
		}
	}

	return (
		<Card>
			<CardHeader className='flex flex-col gap-4 space-y-0 sm:flex-row sm:items-start sm:justify-between'>
				<div className='min-w-0 space-y-1.5'>
					<CardTitle className='flex items-center gap-2 text-lg'>
						<Fingerprint className='h-5 w-5 text-muted-foreground' aria-hidden='true' />
						{t('title')}
					</CardTitle>
					<CardDescription>{t('description')}</CardDescription>
				</div>
				<Button onClick={() => setAddOpen(true)} className='shrink-0'>
					<Plus className='mr-2 h-4 w-4' aria-hidden='true' />
					{t('add')}
				</Button>
			</CardHeader>
			<CardContent>
				{loading ? (
					<div className='flex items-center gap-2 text-sm text-muted-foreground' role='status'>
						<Loader2 className='h-4 w-4 animate-spin' aria-hidden='true' />
						{t('loading')}
					</div>
				) : passkeys.length === 0 ? (
					<EmptyState
						compact
						icon={Fingerprint}
						title={t('empty')}
						description={t('emptyDescription')}
						className='py-6'
					/>
				) : (
					<div className='space-y-2'>
						{passkeys.map((pk) => (
							<div key={pk.id} className='flex items-center justify-between gap-3 rounded-md border p-3'>
								<div className='min-w-0 space-y-0.5'>
									<p className='truncate font-medium'>{pk.name}</p>
									<p className='text-xs text-muted-foreground'>
										{t('added', { date: formatLocalDate(pk.created_at, locale) })}
										{pk.last_used_at ? ` • ${t('lastUsed', { date: formatLocalDate(pk.last_used_at, locale) })}` : ''}
									</p>
								</div>
								<Button
									variant='ghost'
									size='icon'
									onClick={() => setToDelete(pk)}
									aria-label={t('deleteAria', { name: pk.name })}
									className='shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive'
								>
									<Trash2 className='h-4 w-4' aria-hidden='true' />
								</Button>
							</div>
						))}
					</div>
				)}
			</CardContent>

			<FormDialog
				open={addOpen}
				onOpenChange={(open) => {
					setAddOpen(open)
					if (!open) setNewName('')
				}}
				title={t('addTitle')}
				description={t('addDescription')}
				size='sm'
				submitLabel={t('enroll')}
				cancelLabel={t('cancel')}
				loading={registering}
				onSubmit={handleRegister}
			>
				<div className='space-y-2'>
					<Label htmlFor='passkey-name'>{t('deviceName')}</Label>
					<Input
						id='passkey-name'
						placeholder={t('deviceNamePlaceholder')}
						value={newName}
						onChange={(e) => setNewName(e.target.value)}
						autoComplete='off'
					/>
				</div>
			</FormDialog>

			<ConfirmDialog
				open={toDelete !== null}
				onOpenChange={(open) => !open && setToDelete(null)}
				title={t('deleteTitle', { name: toDelete?.name ?? '' })}
				description={t('deleteDescription')}
				destructive
				onConfirm={() => (toDelete ? handleDelete(toDelete.id) : undefined)}
			/>
		</Card>
	)
}
