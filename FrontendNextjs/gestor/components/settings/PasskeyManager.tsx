'use client'

import { startRegistration } from '@simplewebauthn/browser'
import { Fingerprint, Loader2, Plus, Trash2 } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { type PasskeySummary, passkeyRepository } from '@/app/repository/passkeyRepository'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

function formatDate(dateStr: string, locale: string): string {
	return new Date(dateStr).toLocaleDateString(locale, { year: 'numeric', month: 'short', day: '2-digit' })
}

export function PasskeyManager() {
	const t = useTranslations('settingsModal.passkeys')
	const locale = useLocale()
	// Keep `load` stable: `t` may change identity between renders.
	const tRef = useRef(t)
	tRef.current = t
	const [passkeys, setPasskeys] = useState<PasskeySummary[]>([])
	const [loading, setLoading] = useState(true)
	const [addOpen, setAddOpen] = useState(false)
	const [newName, setNewName] = useState('')
	const [registering, setRegistering] = useState(false)
	const [deletingId, setDeletingId] = useState<string | null>(null)

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

	const handleDelete = async (id: string) => {
		setDeletingId(id)
		try {
			await passkeyRepository.delete(id)
			toast.success(t('removed'))
			setPasskeys((prev) => prev.filter((p) => p.id !== id))
		} catch (err) {
			console.error('Passkey delete error:', err)
			toast.error(t('removeError'))
		} finally {
			setDeletingId(null)
		}
	}

	return (
		<Card>
			<CardHeader className='flex flex-row items-center justify-between'>
				<div>
					<CardTitle className='flex items-center gap-2'>
						<Fingerprint className='h-5 w-5' />
						{t('title')}
					</CardTitle>
					<CardDescription>{t('description')}</CardDescription>
				</div>
				<Button onClick={() => setAddOpen(true)}>
					<Plus className='mr-2 h-4 w-4' />
					{t('add')}
				</Button>
			</CardHeader>
			<CardContent>
				{loading ? (
					<div className='flex items-center gap-2 text-sm text-muted-foreground'>
						<Loader2 className='h-4 w-4 animate-spin' />
						{t('loading')}
					</div>
				) : passkeys.length === 0 ? (
					<p className='text-sm text-muted-foreground'>{t('empty')}</p>
				) : (
					<div className='space-y-2'>
						{passkeys.map((pk) => (
							<div key={pk.id} className='flex items-center justify-between rounded-md border border-border/50 p-3'>
								<div className='space-y-0.5'>
									<p className='font-medium'>{pk.name}</p>
									<p className='text-xs text-muted-foreground'>
										{t('added', { date: formatDate(pk.created_at, locale) })}
										{pk.last_used_at ? ` • ${t('lastUsed', { date: formatDate(pk.last_used_at, locale) })}` : ''}
									</p>
								</div>
								<Button
									variant='ghost'
									size='sm'
									onClick={() => handleDelete(pk.id)}
									disabled={deletingId === pk.id}
									aria-label={t('deleteAria', { name: pk.name })}
									className='text-destructive hover:text-destructive'
								>
									{deletingId === pk.id ? <Loader2 className='h-4 w-4 animate-spin' /> : <Trash2 className='h-4 w-4' />}
								</Button>
							</div>
						))}
					</div>
				)}
			</CardContent>

			<Dialog open={addOpen} onOpenChange={setAddOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>{t('addTitle')}</DialogTitle>
						<DialogDescription>{t('addDescription')}</DialogDescription>
					</DialogHeader>
					<div className='space-y-2 py-4'>
						<Label htmlFor='passkey-name'>{t('deviceName')}</Label>
						<Input
							id='passkey-name'
							placeholder={t('deviceNamePlaceholder')}
							value={newName}
							onChange={(e) => setNewName(e.target.value)}
							disabled={registering}
						/>
					</div>
					<DialogFooter>
						<Button variant='outline' onClick={() => setAddOpen(false)} disabled={registering}>
							{t('cancel')}
						</Button>
						<Button onClick={handleRegister} disabled={registering}>
							{registering ? <Loader2 className='mr-2 h-4 w-4 animate-spin' /> : null}
							{t('enroll')}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</Card>
	)
}
