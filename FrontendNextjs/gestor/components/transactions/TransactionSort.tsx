'use client'

import { ArrowUpDown } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useTransactionContext } from './TransactionContext'

type SortOrder = 'asc' | 'desc'

const SORT_GROUPS = [
	{
		label: 'date',
		options: [
			{ sortBy: 'created_at', sortOrder: 'desc', label: 'newestFirst' },
			{ sortBy: 'created_at', sortOrder: 'asc', label: 'oldestFirst' },
		],
	},
	{
		label: 'amount',
		options: [
			{ sortBy: 'amount', sortOrder: 'desc', label: 'highestFirst' },
			{ sortBy: 'amount', sortOrder: 'asc', label: 'lowestFirst' },
		],
	},
	{
		label: 'name',
		options: [
			{ sortBy: 'transaction_name', sortOrder: 'asc', label: 'nameAZ' },
			{ sortBy: 'transaction_name', sortOrder: 'desc', label: 'nameZA' },
		],
	},
] as const satisfies ReadonlyArray<{
	label: string
	options: ReadonlyArray<{ sortBy: string; sortOrder: SortOrder; label: string }>
}>

export function TransactionSort() {
	const t = useTranslations('transactions')
	const { filters, setFilters } = useTransactionContext()

	const currentSortLabel = () => {
		if (filters.sortBy === 'amount') return filters.sortOrder === 'desc' ? t('sortAmountDesc') : t('sortAmountAsc')
		if (filters.sortBy === 'transaction_name') return filters.sortOrder === 'asc' ? t('sortNameAsc') : t('sortNameDesc')
		return filters.sortOrder === 'asc' ? t('sortDateOld') : t('sortDateNew')
	}

	const handleSortChange = (value: string) => {
		const [sortBy, sortOrder] = value.split(':') as [string, SortOrder]
		setFilters((prev) => ({ ...prev, sortBy, sortOrder }))
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant='outline' size='sm' aria-label={`${t('sortBy')}: ${currentSortLabel()}`}>
					<ArrowUpDown className='h-4 w-4 sm:mr-2' aria-hidden='true' />
					<span className='hidden sm:inline'>{currentSortLabel()}</span>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align='end' className='w-56'>
				<DropdownMenuLabel>{t('sortBy')}</DropdownMenuLabel>
				<DropdownMenuRadioGroup value={`${filters.sortBy}:${filters.sortOrder}`} onValueChange={handleSortChange}>
					{SORT_GROUPS.map((group) => (
						<div key={group.label}>
							<DropdownMenuSeparator />
							<DropdownMenuLabel className='text-xs font-normal text-muted-foreground'>
								{t(group.label)}
							</DropdownMenuLabel>
							{group.options.map((option) => (
								<DropdownMenuRadioItem key={option.label} value={`${option.sortBy}:${option.sortOrder}`}>
									{t(option.label)}
								</DropdownMenuRadioItem>
							))}
						</div>
					))}
				</DropdownMenuRadioGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	)
}
