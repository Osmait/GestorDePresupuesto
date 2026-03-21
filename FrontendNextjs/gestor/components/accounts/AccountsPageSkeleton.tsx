import { AccountCardSkeleton } from '@/components/accounts/AccountCardSkeleton'
import { AccountSummarySkeleton } from '@/components/accounts/AccountSummarySkeleton'
import { Skeleton } from '@/components/ui/skeleton'

export function AccountsPageSkeleton() {
	return (
		<div className='space-y-6'>
			{/* Account Summary Skeleton */}
			<div className='mb-8'>
				<AccountSummarySkeleton />
			</div>

			{/* Tabs Skeleton */}
			<div className='space-y-6'>
				<div className='flex gap-2 mb-6'>
					<Skeleton className='h-10 w-24 rounded-full' />
					<Skeleton className='h-10 w-24 rounded-full' />
					<Skeleton className='h-10 w-24 rounded-full' />
				</div>

				{/* Account Card Grid Skeleton */}
				<div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
					{['sk-1', 'sk-2', 'sk-3', 'sk-4', 'sk-5', 'sk-6'].map((key) => (
						<AccountCardSkeleton key={key} />
					))}
				</div>
			</div>
		</div>
	)
}
