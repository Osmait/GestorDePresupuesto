'use client'
import { ArrowDownRight, ArrowUpRight, Building, Edit, MoreHorizontal, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useAppLocale } from '@/lib/i18n/date-locale'
import { DEFAULT_CURRENCY, formatCurrency } from '@/lib/utils'
import { Account } from '@/types/account'

interface AccountCardProps {
	account: Account
	onAccountDeleted?: () => void | Promise<void>
	onAccountEdit?: (_account: Account) => void
}

export function AccountCard({ account, onAccountDeleted, onAccountEdit }: AccountCardProps) {
	const t = useTranslations('accounts')
	const tForms = useTranslations('forms')
	const locale = useAppLocale()
	const [showDeleteDialog, setShowDeleteDialog] = useState(false)
	const [isDeleting, setIsDeleting] = useState(false)

	const currency = account.currency || DEFAULT_CURRENCY
	const currentBalance = account.current_balance ?? account.initial_balance ?? 0
	const initialBalance = account.initial_balance ?? 0
	const balanceDelta = currentBalance - initialBalance
	const isPositive = currentBalance > 0
	const hasGrowth = balanceDelta > 0
	const formatMoney = (value: number, signDisplay?: 'exceptZero') =>
		formatCurrency(value, currency, { locale, signDisplay })

	const handleDeleteAccount = async () => {
		if (!account.id || !onAccountDeleted) return

		setIsDeleting(true)
		try {
			await onAccountDeleted()
			setShowDeleteDialog(false)
		} catch (error) {
			console.error('Error deleting account:', error)
		} finally {
			setIsDeleting(false)
		}
	}

	return (
		<>
			{/*
			 * The account name is a real link stretched over the whole card
			 * (after:absolute after:inset-0), so the card is reachable with the
			 * keyboard and announced as a link. The menu sits above it (z-10).
			 */}
			<Card className='relative hover:bg-accent/40 dark:hover:bg-accent/40 transition-colors duration-300 border-border/50 dark:border-border/20 has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-ring has-[a:focus-visible]:ring-offset-2 has-[a:focus-visible]:ring-offset-background'>
				<CardContent className='p-4 sm:p-6'>
					<div className='flex items-center justify-between gap-2 mb-4'>
						<div className='flex min-w-0 items-center gap-3 sm:gap-4'>
							<Avatar className='h-12 w-12 sm:h-14 sm:w-14 shrink-0 border-2 border-primary/20'>
								<AvatarFallback className='bg-gradient-to-br from-primary/80 to-primary text-primary-foreground font-semibold text-lg'>
									{(account.name ?? '').charAt(0).toUpperCase()}
								</AvatarFallback>
							</Avatar>
							<div className='min-w-0'>
								<Link
									href={`/app/accounts/${account.id}`}
									className='block truncate font-semibold text-foreground text-lg focus-visible:outline-none after:absolute after:inset-0'
								>
									{account.name}
								</Link>
								<p className='text-sm text-muted-foreground flex items-center gap-1 min-w-0'>
									<Building className='h-4 w-4 shrink-0' aria-hidden='true' />
									<span className='truncate'>{account.bank}</span>
								</p>
							</div>
						</div>
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button
									variant='ghost'
									size='sm'
									className='relative z-10 h-8 w-8 shrink-0 p-0'
									aria-label={t('options', { name: account.name })}
								>
									<MoreHorizontal className='h-4 w-4' aria-hidden='true' />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align='end'>
								<DropdownMenuItem
									className='flex items-center gap-2 cursor-pointer'
									onClick={() => onAccountEdit?.(account)}
								>
									<Edit className='h-4 w-4' />
									{t('edit')}
								</DropdownMenuItem>
								<DropdownMenuItem
									className='flex items-center gap-2 cursor-pointer text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400'
									onClick={() => setShowDeleteDialog(true)}
								>
									<Trash2 className='h-4 w-4' />
									{t('delete')}
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
					<div className='space-y-3'>
						<div className='flex flex-wrap justify-between items-center gap-x-2'>
							<span className='text-sm text-muted-foreground'>{t('currentBalance')}</span>
							<div className='flex min-w-0 items-center gap-2'>
								{isPositive ? (
									<ArrowUpRight className='h-4 w-4 shrink-0 text-green-600 dark:text-green-400' aria-hidden='true' />
								) : (
									<ArrowDownRight className='h-4 w-4 shrink-0 text-red-600 dark:text-red-400' aria-hidden='true' />
								)}
								<span
									className={`font-bold text-xl sm:text-2xl tabular-nums break-all ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}
								>
									{formatMoney(currentBalance)}
								</span>
							</div>
						</div>
						{balanceDelta !== 0 && (
							<div className='flex flex-wrap justify-between items-center gap-x-2 text-xs'>
								<span className='text-muted-foreground'>
									{t('initial')}: {formatMoney(initialBalance)}
								</span>
								<span
									className={`font-medium tabular-nums ${hasGrowth ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}
								>
									{formatMoney(balanceDelta, 'exceptZero')}
								</span>
							</div>
						)}
						<div className='flex justify-between items-center pt-2 border-t border-border/50'>
							<span className='text-xs text-muted-foreground'>{currency}</span>
							<Badge variant='outline' className='bg-muted/30 dark:bg-muted/20'>
								{currentBalance > 10000 ? t('high') : currentBalance > 5000 ? t('medium') : t('low')}
							</Badge>
						</div>
					</div>
				</CardContent>
			</Card>

			<Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>{t('deleteTitle')}</DialogTitle>
						<DialogDescription>{t('deleteDescription', { name: account.name })}</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button variant='outline' onClick={() => setShowDeleteDialog(false)} disabled={isDeleting}>
							{tForms('cancel')}
						</Button>
						<Button variant='destructive' onClick={handleDeleteAccount} disabled={isDeleting}>
							{isDeleting ? t('deleting') : tForms('delete')}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	)
}
