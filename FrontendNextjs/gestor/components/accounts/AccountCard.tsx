'use client'
import { Building, Edit, MoreHorizontal, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { toast } from 'sonner'
import { Amount } from '@/components/shared/Amount'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { DEFAULT_CURRENCY } from '@/lib/utils'
import { Account } from '@/types/account'

interface AccountCardProps {
	account: Account
	/** Deletes the account (after confirmation). Omit both handlers for a read-only card (no menu). */
	onAccountDeleted?: () => void | Promise<void>
	onAccountEdit?: (_account: Account) => void
}

export function AccountCard({ account, onAccountDeleted, onAccountEdit }: AccountCardProps) {
	const t = useTranslations('accounts')
	const tCommon = useTranslations('common')
	const [showDeleteDialog, setShowDeleteDialog] = useState(false)

	const currency = account.currency || DEFAULT_CURRENCY
	const currentBalance = account.current_balance ?? account.initial_balance ?? 0
	const initialBalance = account.initial_balance ?? 0
	const balanceDelta = currentBalance - initialBalance
	const hasActions = Boolean(onAccountEdit || onAccountDeleted)

	const handleDeleteAccount = async () => {
		if (!account.id || !onAccountDeleted) return
		try {
			await onAccountDeleted()
		} catch (error) {
			toast.error(t('deleteError'))
			throw error
		}
	}

	return (
		<>
			{/*
			 * The account name is a real link stretched over the whole card
			 * (after:absolute after:inset-0), so the card is reachable with the
			 * keyboard and announced as a link. The menu sits above it (z-10).
			 */}
			<Card className='relative transition-colors hover:bg-muted/40 has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-ring has-[a:focus-visible]:ring-offset-2 has-[a:focus-visible]:ring-offset-background'>
				<CardContent className='p-5'>
					<div className='mb-4 flex items-center justify-between gap-2'>
						<div className='flex min-w-0 items-center gap-3'>
							<Avatar className='h-10 w-10 shrink-0'>
								<AvatarFallback className='bg-muted font-semibold text-foreground'>
									{(account.name ?? '').charAt(0).toUpperCase()}
								</AvatarFallback>
							</Avatar>
							<div className='min-w-0'>
								<Link
									href={`/app/accounts/${account.id}`}
									className='block truncate text-base font-semibold text-foreground focus-visible:outline-none after:absolute after:inset-0'
								>
									{account.name}
								</Link>
								<p className='flex min-w-0 items-center gap-1 text-sm text-muted-foreground'>
									<Building className='h-4 w-4 shrink-0' aria-hidden='true' />
									<span className='truncate'>{account.bank}</span>
								</p>
							</div>
						</div>
						{hasActions ? (
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button
										variant='ghost'
										size='icon'
										className='relative z-10 shrink-0'
										aria-label={tCommon('actions.rowMenu', { name: account.name })}
									>
										<MoreHorizontal className='h-4 w-4' aria-hidden='true' />
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent align='end'>
									{onAccountEdit ? (
										<DropdownMenuItem className='flex items-center gap-2' onSelect={() => onAccountEdit(account)}>
											<Edit className='h-4 w-4' aria-hidden='true' />
											{t('edit')}
										</DropdownMenuItem>
									) : null}
									{onAccountDeleted ? (
										<DropdownMenuItem
											className='flex items-center gap-2 text-destructive focus:text-destructive'
											onSelect={() => setShowDeleteDialog(true)}
										>
											<Trash2 className='h-4 w-4' aria-hidden='true' />
											{t('delete')}
										</DropdownMenuItem>
									) : null}
								</DropdownMenuContent>
							</DropdownMenu>
						) : null}
					</div>
					<div className='space-y-2'>
						<div className='flex flex-wrap items-baseline justify-between gap-x-2'>
							<span className='text-sm text-muted-foreground'>{t('currentBalance')}</span>
							<Amount
								value={currentBalance}
								currency={currency}
								tone='auto'
								icon
								className='min-w-0 text-2xl font-semibold tracking-tight'
							/>
						</div>
						{balanceDelta !== 0 && (
							<div className='flex flex-wrap items-center justify-between gap-x-2 text-xs'>
								<span className='text-muted-foreground'>
									{t('initial')}: <Amount value={initialBalance} currency={currency} />
								</span>
								<Amount value={balanceDelta} currency={currency} tone='auto' signed className='font-medium' />
							</div>
						)}
						<div className='flex items-center justify-between border-t pt-3'>
							<span className='text-xs text-muted-foreground'>{currency}</span>
							<Badge variant='outline'>
								{currentBalance > 10000 ? t('high') : currentBalance > 5000 ? t('medium') : t('low')}
							</Badge>
						</div>
					</div>
				</CardContent>
			</Card>

			{onAccountDeleted ? (
				<ConfirmDialog
					open={showDeleteDialog}
					onOpenChange={setShowDeleteDialog}
					title={t('deleteTitle', { name: account.name })}
					description={tCommon('confirm.irreversible')}
					destructive
					onConfirm={handleDeleteAccount}
				/>
			) : null}
		</>
	)
}
