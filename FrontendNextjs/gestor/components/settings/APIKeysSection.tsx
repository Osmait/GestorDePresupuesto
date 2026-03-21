'use client'

import { Check, Copy, Key, Loader2, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
import { Separator } from '@/components/ui/separator'
import { useCreateAPIKeyMutation, useGetAPIKeys, useRevokeAPIKeyMutation } from '@/hooks/queries/useAPIKeysQuery'
import { CreateAPIKeyResponse } from '@/types/apikey'

function formatDate(dateStr: string | null): string {
	if (!dateStr) return 'Nunca'
	return new Date(dateStr).toLocaleDateString('es-ES', {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
	})
}

export function APIKeysSection() {
	const { data: apiKeys = [], isLoading } = useGetAPIKeys()
	const createMutation = useCreateAPIKeyMutation()
	const revokeMutation = useRevokeAPIKeyMutation()

	const [createDialogOpen, setCreateDialogOpen] = useState(false)
	const [newKeyName, setNewKeyName] = useState('')
	const [createdKey, setCreatedKey] = useState<CreateAPIKeyResponse | null>(null)
	const [copiedToken, setCopiedToken] = useState(false)
	const [copiedConfig, setCopiedConfig] = useState(false)
	const [revokeDialogId, setRevokeDialogId] = useState<string | null>(null)

	const handleCreateKey = async () => {
		if (!newKeyName.trim()) return
		try {
			const result = await createMutation.mutateAsync(newKeyName.trim())
			setCreatedKey(result)
			setNewKeyName('')
		} catch {
			toast.error('Error al crear la clave API')
		}
	}

	const handleCloseCreateDialog = () => {
		setCreateDialogOpen(false)
		setCreatedKey(null)
		setNewKeyName('')
		setCopiedToken(false)
	}

	const handleCopyToken = async () => {
		if (!createdKey) return
		await navigator.clipboard.writeText(createdKey.token)
		setCopiedToken(true)
		toast.success('Token copiado al portapapeles')
		setTimeout(() => setCopiedToken(false), 2000)
	}

	const handleRevokeKey = async () => {
		if (!revokeDialogId) return
		try {
			await revokeMutation.mutateAsync(revokeDialogId)
			toast.success('Clave API revocada')
			setRevokeDialogId(null)
		} catch {
			toast.error('Error al revocar la clave API')
		}
	}

	const claudeConfig = `{
  "mcpServers": {
    "gestor-presupuesto": {
      "command": "npx",
      "args": ["-y", "gestor-presupuesto-mcp"],
      "env": {
        "API_KEY": "<your-api-key-here>"
      }
    }
  }
}`

	const handleCopyConfig = async () => {
		await navigator.clipboard.writeText(claudeConfig)
		setCopiedConfig(true)
		toast.success('Configuración copiada al portapapeles')
		setTimeout(() => setCopiedConfig(false), 2000)
	}

	return (
		<div className='space-y-8 animate-in fade-in-50 duration-300'>
			{/* Header */}
			<div>
				<h3 className='text-lg font-medium'>Claves API</h3>
				<p className='text-sm text-muted-foreground'>Administra las claves API para integraciones con servidores MCP</p>
				<Separator className='my-4' />
			</div>

			{/* Create key button */}
			<div className='flex justify-end'>
				<Button onClick={() => setCreateDialogOpen(true)} size='sm' className='gap-2'>
					<Plus className='h-4 w-4' />
					Nueva clave
				</Button>
			</div>

			{/* Keys list */}
			{isLoading ? (
				<div className='flex items-center justify-center py-8'>
					<Loader2 className='h-5 w-5 animate-spin text-muted-foreground' />
				</div>
			) : apiKeys.length === 0 ? (
				<div className='flex flex-col items-center justify-center py-12 text-center border rounded-lg bg-muted/20'>
					<Key className='h-8 w-8 text-muted-foreground mb-3' />
					<p className='text-sm font-medium'>No hay claves API</p>
					<p className='text-xs text-muted-foreground mt-1'>Crea una clave para conectar clientes MCP</p>
				</div>
			) : (
				<div className='space-y-3'>
					{apiKeys.map((key) => (
						<div key={key.id} className='flex items-center justify-between p-4 border rounded-lg'>
							<div className='space-y-1 min-w-0'>
								<div className='flex items-center gap-2'>
									<span className='font-medium text-sm truncate'>{key.name}</span>
									{key.is_active ? (
										<Badge variant='outline' className='text-green-500 border-green-500 shrink-0'>
											Activa
										</Badge>
									) : (
										<Badge variant='outline' className='text-muted-foreground shrink-0'>
											Inactiva
										</Badge>
									)}
								</div>
								<p className='text-xs text-muted-foreground font-mono'>{key.key_prefix}...</p>
								<div className='flex gap-4 text-xs text-muted-foreground'>
									<span>Creada: {formatDate(key.created_at)}</span>
									<span>Último uso: {formatDate(key.last_used_at)}</span>
								</div>
							</div>
							<Button
								variant='ghost'
								size='sm'
								className='text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0'
								onClick={() => setRevokeDialogId(key.id)}
							>
								<Trash2 className='h-4 w-4' />
							</Button>
						</div>
					))}
				</div>
			)}

			{/* Claude Desktop configuration */}
			<div>
				<h3 className='text-lg font-medium'>Configuración de Claude Desktop</h3>
				<p className='text-sm text-muted-foreground'>
					Añade esta configuración a tu archivo{' '}
					<code className='text-xs bg-muted px-1 py-0.5 rounded'>claude_desktop_config.json</code>
				</p>
				<Separator className='my-4' />
				<div className='relative'>
					<pre className='text-xs bg-muted rounded-lg p-4 overflow-x-auto border'>{claudeConfig}</pre>
					<Button variant='outline' size='sm' className='absolute top-2 right-2 gap-1.5' onClick={handleCopyConfig}>
						{copiedConfig ? <Check className='h-3.5 w-3.5' /> : <Copy className='h-3.5 w-3.5' />}
						{copiedConfig ? 'Copiado' : 'Copiar'}
					</Button>
				</div>
			</div>

			{/* Create key dialog */}
			<Dialog open={createDialogOpen} onOpenChange={(open) => !open && handleCloseCreateDialog()}>
				<DialogContent className='sm:max-w-md'>
					<DialogHeader>
						<DialogTitle>Crear nueva clave API</DialogTitle>
						<DialogDescription>Dale un nombre descriptivo a la clave para identificarla fácilmente.</DialogDescription>
					</DialogHeader>

					{createdKey ? (
						<div className='space-y-4'>
							<div className='rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-900/10 dark:border-amber-900/50 p-4'>
								<p className='text-sm font-medium text-amber-700 dark:text-amber-400'>Guarda este token ahora</p>
								<p className='text-xs text-amber-600/80 dark:text-amber-400/80 mt-1'>
									Este token no se volverá a mostrar. Cópialo y guárdalo en un lugar seguro.
								</p>
							</div>
							<div className='space-y-2'>
								<Label>Token</Label>
								<div className='flex gap-2'>
									<code className='flex-1 text-xs bg-muted rounded-md px-3 py-2 border font-mono break-all'>
										{createdKey.token}
									</code>
									<Button variant='outline' size='sm' onClick={handleCopyToken} className='shrink-0 gap-1.5'>
										{copiedToken ? <Check className='h-3.5 w-3.5' /> : <Copy className='h-3.5 w-3.5' />}
									</Button>
								</div>
							</div>
							<DialogFooter>
								<Button onClick={handleCloseCreateDialog} className='w-full'>
									Ya lo guardé, cerrar
								</Button>
							</DialogFooter>
						</div>
					) : (
						<>
							<div className='space-y-2'>
								<Label htmlFor='key-name'>Nombre</Label>
								<Input
									id='key-name'
									placeholder='ej. Claude Desktop'
									value={newKeyName}
									onChange={(e) => setNewKeyName(e.target.value)}
									onKeyDown={(e) => e.key === 'Enter' && handleCreateKey()}
								/>
							</div>
							<DialogFooter>
								<Button variant='outline' onClick={handleCloseCreateDialog}>
									Cancelar
								</Button>
								<Button
									onClick={handleCreateKey}
									disabled={!newKeyName.trim() || createMutation.isPending}
									className='gap-2'
								>
									{createMutation.isPending && <Loader2 className='h-4 w-4 animate-spin' />}
									Crear clave
								</Button>
							</DialogFooter>
						</>
					)}
				</DialogContent>
			</Dialog>

			{/* Revoke confirmation dialog */}
			<Dialog open={!!revokeDialogId} onOpenChange={(open) => !open && setRevokeDialogId(null)}>
				<DialogContent className='sm:max-w-md'>
					<DialogHeader>
						<DialogTitle>Revocar clave API</DialogTitle>
						<DialogDescription>
							Esta acción es irreversible. La clave dejará de funcionar inmediatamente y no podrás recuperarla.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button variant='outline' onClick={() => setRevokeDialogId(null)}>
							Cancelar
						</Button>
						<Button
							variant='destructive'
							onClick={handleRevokeKey}
							disabled={revokeMutation.isPending}
							className='gap-2'
						>
							{revokeMutation.isPending && <Loader2 className='h-4 w-4 animate-spin' />}
							Revocar clave
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	)
}
