'use client'

import { startRegistration } from '@simplewebauthn/browser'
import { format } from 'date-fns'
import { Fingerprint, Loader2, Plus, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
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

export function PasskeyManager() {
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
			toast.error('Failed to load passkeys')
		} finally {
			setLoading(false)
		}
	}, [])

	useEffect(() => {
		load()
	}, [load])

	const handleRegister = async () => {
		if (!newName.trim()) {
			toast.error('Give this passkey a name')
			return
		}
		setRegistering(true)
		try {
			const begin = await passkeyRepository.beginRegistration()
			const options = (begin.options as any)?.publicKey ?? begin.options
			const attestation = await startRegistration(options)
			await passkeyRepository.finishRegistration(begin.session_id, newName.trim(), attestation)
			toast.success('Passkey registered')
			setAddOpen(false)
			setNewName('')
			await load()
		} catch (err) {
			const msg = err instanceof Error ? err.message : 'Passkey registration failed'
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
			toast.success('Passkey removed')
			setPasskeys((prev) => prev.filter((p) => p.id !== id))
		} catch (err) {
			console.error('Passkey delete error:', err)
			toast.error('Failed to remove passkey')
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
						Passkeys
					</CardTitle>
					<CardDescription>
						Sign in with your fingerprint or face instead of your password. Add one per device.
					</CardDescription>
				</div>
				<Button onClick={() => setAddOpen(true)}>
					<Plus className='mr-2 h-4 w-4' />
					Add passkey
				</Button>
			</CardHeader>
			<CardContent>
				{loading ? (
					<div className='flex items-center gap-2 text-sm text-muted-foreground'>
						<Loader2 className='h-4 w-4 animate-spin' />
						Loading…
					</div>
				) : passkeys.length === 0 ? (
					<p className='text-sm text-muted-foreground'>No passkeys registered yet.</p>
				) : (
					<div className='space-y-2'>
						{passkeys.map((pk) => (
							<div key={pk.id} className='flex items-center justify-between rounded-md border border-border/50 p-3'>
								<div className='space-y-0.5'>
									<p className='font-medium'>{pk.name}</p>
									<p className='text-xs text-muted-foreground'>
										Added {format(new Date(pk.created_at), 'LLL dd, yyyy')}
										{pk.last_used_at ? ` • last used ${format(new Date(pk.last_used_at), 'LLL dd, yyyy')}` : ''}
									</p>
								</div>
								<Button
									variant='ghost'
									size='sm'
									onClick={() => handleDelete(pk.id)}
									disabled={deletingId === pk.id}
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
						<DialogTitle>Add a passkey</DialogTitle>
						<DialogDescription>
							Your device will prompt you to authenticate with your fingerprint, face, or device PIN.
						</DialogDescription>
					</DialogHeader>
					<div className='space-y-2 py-4'>
						<Label htmlFor='passkey-name'>Device name</Label>
						<Input
							id='passkey-name'
							placeholder='e.g. MacBook Pro, iPhone'
							value={newName}
							onChange={(e) => setNewName(e.target.value)}
							disabled={registering}
						/>
					</div>
					<DialogFooter>
						<Button variant='outline' onClick={() => setAddOpen(false)} disabled={registering}>
							Cancel
						</Button>
						<Button onClick={handleRegister} disabled={registering}>
							{registering ? <Loader2 className='mr-2 h-4 w-4 animate-spin' /> : null}
							Enroll
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</Card>
	)
}
