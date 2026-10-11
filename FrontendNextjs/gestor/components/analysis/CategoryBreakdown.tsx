'use client'

import { PieChart } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { CSSProperties } from 'react'
import { EmptyState } from '@/components/shared/EmptyState'
import { Progress } from '@/components/ui/progress'
import { useFormatCurrency } from '@/hooks/useFormatCurrency'
import { useFormatPercent } from '@/hooks/useFormatPercent'
import type { CategoryExpense } from '@/types/analytics'
import { SectionCard } from './SectionCard'

/**
 * "En qué se fue": the one category breakdown of the page, sorted by amount,
 * each bar in the category's own color (relative to the biggest one).
 */
export function CategoryBreakdown({ categories, current }: { categories: CategoryExpense[]; current: boolean }) {
	const t = useTranslations('analysis')
	const formatCurrency = useFormatCurrency()
	const formatPercent = useFormatPercent()
	const rows = categories.filter((item) => item.value > 0).sort((a, b) => b.value - a.value)
	const total = rows.reduce((sum, item) => sum + item.value, 0)
	const max = rows[0]?.value ?? 0

	return (
		<SectionCard
			id='analysis-categories-title'
			title={current ? t('categoriesTitleCurrent') : t('categoriesTitle')}
			className='gap-3'
		>
			{rows.length === 0 ? (
				<EmptyState compact icon={PieChart} title={t('noData')} />
			) : (
				<ul className='flex flex-col gap-2.5'>
					{rows.map((item) => {
						const label = item.label || t('noCategory')
						const share = total > 0 ? (item.value / total) * 100 : 0
						const amount = formatCurrency(item.value, 'DOP', { maximumFractionDigits: 0 })
						const percent = formatPercent(share, { maximumFractionDigits: 0 })
						return (
							<li
								key={item.id || label}
								className='grid grid-cols-[minmax(0,7rem)_minmax(0,1fr)_auto] items-center gap-2.5 text-sm'
							>
								<span className='truncate'>{label}</span>
								<Progress
									value={max > 0 ? (item.value / max) * 100 : 0}
									aria-label={t('categoryShareLabel', { category: label, amount, percent })}
									className='bg-muted'
									indicatorClassName='bg-(--category-color)'
									style={{ '--category-color': item.color || 'hsl(var(--muted-foreground))' } as CSSProperties}
								/>
								<span className='text-right tabular-nums'>
									<span className='font-medium'>{amount}</span> <span className='text-muted-foreground'>{percent}</span>
								</span>
							</li>
						)
					})}
				</ul>
			)}
		</SectionCard>
	)
}
