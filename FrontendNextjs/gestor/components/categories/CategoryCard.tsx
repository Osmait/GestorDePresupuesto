'use client'

import { Edit, MoreHorizontal, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { toast } from 'sonner'
import { Amount } from '@/components/shared/Amount'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { CategoryExpense } from '@/types/analytics'
import { Category } from '@/types/category'

export interface CategoryCardProps {
	category: Category
	stats?: CategoryExpense
	onDelete: () => Promise<void>
	onEdit: () => void
}

export function CategoryCard({ category, stats, onDelete, onEdit }: CategoryCardProps) {
	const t = useTranslations('categories')
	const tCommon = useTranslations('common')
	const [showDeleteDialog, setShowDeleteDialog] = useState(false)
	const transactionCount = stats?.transaction_count || 0
	const totalAmountDOP = stats?.value || 0
	const dopTotal = stats?.dop_total || 0
	const usdTotal = stats?.usd_total || 0

	const handleDelete = async () => {
		try {
			await onDelete()
		} catch (error) {
			toast.error(t('deleteError'))
			throw error
		}
	}

	return (
		<>
			{/*
			 * The name is a real link to the category's transactions, stretched over
			 * the card (after:absolute after:inset-0). The menu sits above it (z-10)
			 * and is always visible, so it works on touch and with the keyboard.
			 */}
			<Card className='relative transition-colors hover:bg-muted/40 has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-ring has-[a:focus-visible]:ring-offset-2 has-[a:focus-visible]:ring-offset-background'>
				<CardContent className='p-5'>
					<div className='mb-4 flex items-start justify-between gap-2'>
						<div className='flex min-w-0 items-center gap-3'>
							{/* Category color and emoji are user data. */}
							<div
								className='flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg'
								style={{ backgroundColor: category.color }}
								aria-hidden='true'
							>
								{category.icon}
							</div>
							<div className='min-w-0'>
								<Link
									href={`/app/transactions?category=${category.id}`}
									className='block truncate text-base font-semibold text-foreground focus-visible:outline-none after:absolute after:inset-0'
								>
									{category.name}
								</Link>
								<p className='text-sm text-muted-foreground tabular-nums'>
									{transactionCount} {t('transactionsCount')}
								</p>
							</div>
						</div>
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button
									variant='ghost'
									size='icon'
									className='relative z-10 shrink-0'
									aria-label={tCommon('actions.rowMenu', { name: category.name })}
								>
									<MoreHorizontal className='h-4 w-4' aria-hidden='true' />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align='end'>
								<DropdownMenuItem className='flex items-center gap-2' onSelect={onEdit}>
									<Edit className='h-4 w-4' aria-hidden='true' />
									{t('edit')}
								</DropdownMenuItem>
								<DropdownMenuItem
									className='flex items-center gap-2 text-destructive focus:text-destructive'
									onSelect={() => setShowDeleteDialog(true)}
								>
									<Trash2 className='h-4 w-4' aria-hidden='true' />
									{t('delete')}
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</div>

					<div className='flex items-baseline justify-between gap-2'>
						<span className='text-sm text-muted-foreground'>{t('totalDop')}</span>
						<Amount value={totalAmountDOP} currency='DOP' className='text-xl font-semibold tracking-tight' />
					</div>

					<div className='mt-4 flex items-center justify-between gap-2 border-t pt-3'>
						<p className='flex flex-wrap gap-x-3 text-xs text-muted-foreground'>
							<span>
								DOP <Amount value={dopTotal} currency='DOP' />
							</span>
							<span>
								USD <Amount value={usdTotal} currency='USD' />
							</span>
						</p>
						<Badge variant='outline' className='shrink-0'>
							{transactionCount > 5 ? t('active') : transactionCount > 0 ? t('moderate') : t('inactive')}
						</Badge>
					</div>
				</CardContent>
			</Card>

			<ConfirmDialog
				open={showDeleteDialog}
				onOpenChange={setShowDeleteDialog}
				title={t('deleteTitle', { name: category.name })}
				description={tCommon('confirm.irreversible')}
				destructive
				onConfirm={handleDelete}
			/>
		</>
	)
}
