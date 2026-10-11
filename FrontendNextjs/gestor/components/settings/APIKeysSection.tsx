'use client'

import { Check, Copy, Key, Loader2, Plus, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { EmptyState } from '@/components/shared/EmptyState'
import { FormDialog } from '@/components/shared/FormDialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { useCreateAPIKeyMutation, useGetAPIKeys, useRevokeAPIKeyMutation } from '@/hooks/queries/useAPIKeysQuery'
import { formatLocalDate, useAppLocale } from '@/lib/i18n/date-locale'
import type { APIKey, CreateAPIKeyResponse } from '@/types/apikey'

const DATE_OPTIONS: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' }

export function APIKeysSection() {
	const t = useTranslations('settingsModal.apiKeys')
	const locale = useAppLocale()
	const formatDate = (value: string) => formatLocalDate(value, locale, DATE_OPTIONS)
	const { data: apiKeys = [], isLoading } = useGetAPIKeys()
	const createMutation = useCreateAPIKeyMutation()
	const revokeMutation = useRevokeAPIKeyMutation()

	const [createDialogOpen, setCreateDialogOpen] = useState(false)
	const [newKeyName, setNewKeyName] = useState('')
	const [createdKey, setCreatedKey] = useState<CreateAPIKeyResponse | null>(null)
	const [copiedToken, setCopiedToken] = useState(false)
	const [copiedConfig, setCopiedConfig] = useState(false)
	const [toRevoke, setToRevoke] = useState<APIKey | null>(null)

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

	// Rejects on failure so the ConfirmDialog stays open for a retry.
	const handleRevokeKey = async () => {
		if (!toRevoke) return
		try {
			await revokeMutation.mutateAsync(toRevoke.id)
			toast.success(t('revoked'))
		} catch (error) {
			toast.error(t('revokeError'))
			throw error
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
				<Button onClick={() => setCreateDialogOpen(true)}>
					<Plus className='mr-2 h-4 w-4' aria-hidden='true' />
					{t('newKey')}
				</Button>
			</div>

			{/* Keys list */}
			{isLoading ? (
				<div className='flex items-center justify-center py-8' role='status'>
					<Loader2 className='h-5 w-5 animate-spin text-muted-foreground' aria-hidden='true' />
					<span className='sr-only'>{t('loading')}</span>
				</div>
			) : apiKeys.length === 0 ? (
				<EmptyState
					compact
					icon={Key}
					title={t('emptyTitle')}
					description={t('emptyDescription')}
					className='rounded-lg border'
				/>
			) : (
				<div className='space-y-3'>
					{apiKeys.map((key) => (
						<div key={key.id} className='flex items-center justify-between gap-3 rounded-lg border p-4'>
							<div className='space-y-1 min-w-0'>
								<div className='flex items-center gap-2'>
									<span className='font-medium text-sm truncate'>{key.name}</span>
									{key.is_active ? (
										<Badge variant='outline' className='shrink-0 border-success/50 text-success'>
											{t('active')}
										</Badge>
									) : (
										<Badge variant='outline' className='text-muted-foreground shrink-0'>
											{t('inactive')}
										</Badge>
									)}
								</div>
								<p className='text-xs text-muted-foreground font-mono'>{key.key_prefix}...</p>
								<div className='flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground'>
									<span>{t('createdAt', { date: formatDate(key.created_at) })}</span>
									<span>
										{t('lastUsedAt', {
											date: key.last_used_at ? formatDate(key.last_used_at) : t('never'),
										})}
									</span>
								</div>
							</div>
							<Button
								variant='ghost'
								size='icon'
								className='shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive'
								onClick={() => setToRevoke(key)}
								aria-label={t('revokeAria', { name: key.name })}
							>
								<Trash2 className='h-4 w-4' aria-hidden='true' />
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
						{copiedConfig ? (
							<Check className='h-3.5 w-3.5' aria-hidden='true' />
						) : (
							<Copy className='h-3.5 w-3.5' aria-hidden='true' />
						)}
						{copiedConfig ? t('copied') : t('copy')}
					</Button>
				</div>
			</div>

			{/* Create key dialog: name form, then the one-time token */}
			<FormDialog
				open={createDialogOpen}
				onOpenChange={(open) => !open && handleCloseCreateDialog()}
				title={t('createTitle')}
				description={t('createDescription')}
				size='sm'
				onSubmit={createdKey ? undefined : handleCreateKey}
				submitLabel={t('create')}
				cancelLabel={t('cancel')}
				loading={createMutation.isPending}
				submitDisabled={!newKeyName.trim()}
				footer={
					createdKey ? (
						<Button type='button' onClick={handleCloseCreateDialog} className='w-full sm:w-auto'>
							{t('savedClose')}
						</Button>
					) : undefined
				}
			>
				{createdKey ? (
					<div className='space-y-4'>
						<div role='alert' className='rounded-lg border border-warning/40 bg-warning/10 p-4'>
							<p className='text-sm font-medium text-warning'>{t('saveTokenTitle')}</p>
							<p className='mt-1 text-xs text-foreground/80'>{t('saveTokenDescription')}</p>
						</div>
						<div className='space-y-2'>
							<p className='text-sm font-medium'>{t('token')}</p>
							<div className='flex gap-2'>
								<code className='flex-1 break-all rounded-md border bg-muted px-3 py-2 font-mono text-xs'>
									{createdKey.token}
								</code>
								<Button
									type='button'
									variant='outline'
									size='icon'
									onClick={handleCopyToken}
									className='shrink-0'
									aria-label={copiedToken ? t('copied') : t('copyToken')}
								>
									{copiedToken ? (
										<Check className='h-4 w-4' aria-hidden='true' />
									) : (
										<Copy className='h-4 w-4' aria-hidden='true' />
									)}
								</Button>
							</div>
						</div>
					</div>
				) : (
					<div className='space-y-2'>
						<Label htmlFor='key-name'>{t('name')}</Label>
						<Input
							id='key-name'
							placeholder={t('namePlaceholder')}
							value={newKeyName}
							onChange={(e) => setNewKeyName(e.target.value)}
							autoComplete='off'
						/>
					</div>
				)}
			</FormDialog>

			<ConfirmDialog
				open={toRevoke !== null}
				onOpenChange={(open) => !open && setToRevoke(null)}
				title={t('revokeTitleNamed', { name: toRevoke?.name ?? '' })}
				description={t('revokeDescription')}
				confirmLabel={t('revoke')}
				cancelLabel={t('cancel')}
				destructive
				onConfirm={handleRevokeKey}
			/>
		</div>
	)
}
