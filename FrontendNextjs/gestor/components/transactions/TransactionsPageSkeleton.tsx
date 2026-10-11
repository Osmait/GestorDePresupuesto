import { StatGridSkeleton } from '@/components/shared/StatGrid'
import { TransactionSkeleton } from '@/components/transactions/TransactionSkeleton'
import { Skeleton } from '@/components/ui/skeleton'

const ROW_KEYS = ['r1', 'r2', 'r3', 'r4', 'r5']

/** Mirrors TransactionsList: KPI row, filter/sort toolbar and rows. */
export function TransactionsPageSkeleton() {
	return (
		<div className='space-y-6' aria-busy='true'>
			<StatGridSkeleton count={3} />

			<div className='flex items-center justify-between gap-3'>
				<Skeleton className='h-10 w-full rounded-lg sm:w-72' />
				<Skeleton className='h-9 w-10 shrink-0 sm:w-40' />
			</div>

			<div className='space-y-3'>
				{ROW_KEYS.map((key) => (
					<TransactionSkeleton key={key} />
				))}
			</div>
		</div>
	)
}
