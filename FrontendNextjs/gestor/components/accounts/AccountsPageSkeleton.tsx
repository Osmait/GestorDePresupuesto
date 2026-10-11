import { AccountCardSkeleton } from '@/components/accounts/AccountCardSkeleton'
import { AccountSummarySkeleton } from '@/components/accounts/AccountSummarySkeleton'
import { Skeleton } from '@/components/ui/skeleton'

/** Mirrors AccountsClient: KPI row, filter control, card grid. */
export function AccountsPageSkeleton() {
	return (
		<div className='space-y-6' aria-busy='true'>
			<AccountSummarySkeleton />
			<div className='flex gap-2'>
				<Skeleton className='h-10 w-24 rounded-full' />
				<Skeleton className='h-10 w-24 rounded-full' />
				<Skeleton className='h-10 w-24 rounded-full' />
			</div>
			<div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3'>
				{['sk-1', 'sk-2', 'sk-3', 'sk-4', 'sk-5', 'sk-6'].map((key) => (
					<AccountCardSkeleton key={key} />
				))}
			</div>
		</div>
	)
}
