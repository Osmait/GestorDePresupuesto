'use client'

import { Edit, MoreHorizontal, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
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
	const tForms = useTranslations('forms')
	const router = useRouter()
	const categoryTransactionsCount = stats?.transaction_count || 0
	const totalAmountDOP = stats?.value || 0
	const totals = {
		dop: stats?.dop_total || 0,
		usd: stats?.usd_total || 0,
	}
	const [showDeleteDialog, setShowDeleteDialog] = useState(false)
	const [isDeleting, setIsDeleting] = useState(false)

	const handleDelete = async () => {
		setIsDeleting(true)
		try {
			await onDelete()
			setShowDeleteDialog(false)
		} catch (error) {
			console.error('Error deleting category:', error)
		} finally {
			setIsDeleting(false)
		}
	}

	const handleCardClick = (e: React.MouseEvent) => {
		if ((e.target as HTMLElement).closest('[role="menuitem"], button')) {
			return
		}
		router.push(`/app/transactions?category=${category.id}`)
	}

	return (
		<Card
			className='hover:bg-accent/40 dark:hover:bg-accent/40 transition-all duration-300 border-border/50 dark:border-border/20 relative group cursor-pointer'
			onClick={handleCardClick}
		>
			<div className='absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity z-10'>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button variant='ghost' size='sm' className='h-8 w-8 p-0 hover:bg-muted'>
							<MoreHorizontal className='h-4 w-4' />
							<span className='sr-only'>{t('openMenu')}</span>
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align='end'>
						<DropdownMenuItem className='flex items-center gap-2 cursor-pointer' onClick={onEdit}>
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

			<CardContent className='p-6'>
				<div className='flex items-center justify-between mb-4'>
					<div className='flex items-center space-x-4'>
						<div
							className='w-12 h-12 rounded-full flex items-center justify-center text-xl font-semibold'
							style={{ backgroundColor: category.color, color: '#fff' }}
						>
							{category.icon}
						</div>
						<div>
							<p className='font-semibold text-foreground text-lg'>{category.name}</p>
							<p className='text-sm text-muted-foreground'>
								{categoryTransactionsCount} {t('transactionsCount')}
							</p>
						</div>
					</div>
					<div className='text-right'>
						<p className='font-bold text-xl text-foreground'>
							{new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(totalAmountDOP)}
						</p>
						<p className='text-xs text-muted-foreground'>Total (DOP)</p>
						<p className='text-[11px] text-muted-foreground'>
							DOP: {new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(totals.dop)}
						</p>
						<p className='text-[11px] text-muted-foreground'>
							USD: {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totals.usd)}
						</p>
					</div>
				</div>

				<div className='flex items-center justify-between pt-3 border-t border-border/50'>
					<div className='flex items-center gap-2'>
						<div className='w-3 h-3 rounded-full' style={{ backgroundColor: category.color }}></div>
						<span className='text-xs text-muted-foreground'>Color</span>
					</div>
					<Badge variant='outline' className='bg-muted/30 dark:bg-muted/20'>
						{categoryTransactionsCount > 5
							? t('active')
							: categoryTransactionsCount > 0
								? t('moderate')
								: t('inactive')}
					</Badge>
				</div>
			</CardContent>

			<Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>{t('deleteTitle')}</DialogTitle>
						<DialogDescription>{t('deleteDescription', { name: category.name })}</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button variant='outline' onClick={() => setShowDeleteDialog(false)} disabled={isDeleting}>
							{tForms('cancel')}
						</Button>
						<Button variant='destructive' onClick={handleDelete} disabled={isDeleting}>
							{isDeleting ? t('deleting') : tForms('delete')}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</Card>
	)
}
