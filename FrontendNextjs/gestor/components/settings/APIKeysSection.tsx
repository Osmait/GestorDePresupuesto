'use client'

import { Check, Copy, Key, Loader2, Plus, Trash2 } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
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

function formatDate(dateStr: string, locale: string): string {
	return new Date(dateStr).toLocaleDateString(locale, {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
	})
}

export function APIKeysSection() {
	const t = useTranslations('settingsModal.apiKeys')
	const locale = useLocale()
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
			toast.error(t('createError'))
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
		toast.success(t('tokenCopied'))
		setTimeout(() => setCopiedToken(false), 2000)
	}

	const handleRevokeKey = async () => {
		if (!revokeDialogId) return
		try {
			await revokeMutation.mutateAsync(revokeDialogId)
			toast.success(t('revoked'))
			setRevokeDialogId(null)
		} catch {
			toast.error(t('revokeError'))
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
		toast.success(t('configCopied'))
		setTimeout(() => setCopiedConfig(false), 2000)
	}

	return (
		<div className='space-y-8 animate-in fade-in-50 duration-300'>
			{/* Header */}
			<div>
				<h3 className='text-lg font-medium'>{t('title')}</h3>
				<p className='text-sm text-muted-foreground'>{t('description')}</p>
				<Separator className='my-4' />
			</div>

			{/* Create key button */}
			<div className='flex justify-end'>
				<Button onClick={() => setCreateDialogOpen(true)} size='sm' className='gap-2'>
					<Plus className='h-4 w-4' />
					{t('newKey')}
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
					<p className='text-sm font-medium'>{t('emptyTitle')}</p>
					<p className='text-xs text-muted-foreground mt-1'>{t('emptyDescription')}</p>
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
											{t('active')}
										</Badge>
									) : (
										<Badge variant='outline' className='text-muted-foreground shrink-0'>
											{t('inactive')}
										</Badge>
									)}
								</div>
								<p className='text-xs text-muted-foreground font-mono'>{key.key_prefix}...</p>
								<div className='flex gap-4 text-xs text-muted-foreground'>
									<span>{t('createdAt', { date: formatDate(key.created_at, locale) })}</span>
									<span>
										{t('lastUsedAt', {
											date: key.last_used_at ? formatDate(key.last_used_at, locale) : t('never'),
										})}
									</span>
								</div>
							</div>
							<Button
								variant='ghost'
								size='sm'
								className='text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0'
								onClick={() => setRevokeDialogId(key.id)}
								aria-label={t('revokeAria', { name: key.name })}
							>
								<Trash2 className='h-4 w-4' />
							</Button>
						</div>
					))}
				</div>
			)}

			{/* Claude Desktop configuration */}
			<div>
				<h3 className='text-lg font-medium'>{t('configTitle')}</h3>
				<p className='text-sm text-muted-foreground'>
					{t('configDescription')}{' '}
					<code className='text-xs bg-muted px-1 py-0.5 rounded'>claude_desktop_config.json</code>
				</p>
				<Separator className='my-4' />
				<div className='relative'>
					<pre className='text-xs bg-muted rounded-lg p-4 overflow-x-auto border'>{claudeConfig}</pre>
					<Button variant='outline' size='sm' className='absolute top-2 right-2 gap-1.5' onClick={handleCopyConfig}>
						{copiedConfig ? <Check className='h-3.5 w-3.5' /> : <Copy className='h-3.5 w-3.5' />}
						{copiedConfig ? t('copied') : t('copy')}
					</Button>
				</div>
			</div>

			{/* Create key dialog */}
			<Dialog open={createDialogOpen} onOpenChange={(open) => !open && handleCloseCreateDialog()}>
				<DialogContent className='sm:max-w-md'>
					<DialogHeader>
						<DialogTitle>{t('createTitle')}</DialogTitle>
						<DialogDescription>{t('createDescription')}</DialogDescription>
					</DialogHeader>

					{createdKey ? (
						<div className='space-y-4'>
							<div className='rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-900/10 dark:border-amber-900/50 p-4'>
								<p className='text-sm font-medium text-amber-700 dark:text-amber-400'>{t('saveTokenTitle')}</p>
								<p className='text-xs text-amber-600/80 dark:text-amber-400/80 mt-1'>{t('saveTokenDescription')}</p>
							</div>
							<div className='space-y-2'>
								<Label>{t('token')}</Label>
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
									{t('savedClose')}
								</Button>
							</DialogFooter>
						</div>
					) : (
						<>
							<div className='space-y-2'>
								<Label htmlFor='key-name'>{t('name')}</Label>
								<Input
									id='key-name'
									placeholder={t('namePlaceholder')}
									value={newKeyName}
									onChange={(e) => setNewKeyName(e.target.value)}
									onKeyDown={(e) => e.key === 'Enter' && handleCreateKey()}
								/>
							</div>
							<DialogFooter>
								<Button variant='outline' onClick={handleCloseCreateDialog}>
									{t('cancel')}
								</Button>
								<Button
									onClick={handleCreateKey}
									disabled={!newKeyName.trim() || createMutation.isPending}
									className='gap-2'
								>
									{createMutation.isPending && <Loader2 className='h-4 w-4 animate-spin' />}
									{t('create')}
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
						<DialogTitle>{t('revokeTitle')}</DialogTitle>
						<DialogDescription>{t('revokeDescription')}</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button variant='outline' onClick={() => setRevokeDialogId(null)}>
							{t('cancel')}
						</Button>
						<Button
							variant='destructive'
							onClick={handleRevokeKey}
							disabled={revokeMutation.isPending}
							className='gap-2'
						>
							{revokeMutation.isPending && <Loader2 className='h-4 w-4 animate-spin' />}
							{t('revoke')}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	)
}
