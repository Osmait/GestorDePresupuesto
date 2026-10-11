import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

/** Mirrors BudgetCard: icon + title/badge + menu, three amount rows, progress, footer. */
export function BudgetCardSkeleton() {
	return (
		<Card>
			<CardContent className='p-5'>
				<div className='mb-4 flex items-start justify-between gap-2'>
					<div className='flex items-center gap-3'>
						<Skeleton className='h-10 w-10 rounded-full' />
						<div className='space-y-2'>
							<Skeleton className='h-5 w-36' />
							<Skeleton className='h-5 w-16 rounded-full' />
						</div>
					</div>
					<Skeleton className='h-10 w-10 rounded-md' />
				</div>
				<div className='space-y-2'>
					{['budget', 'spent', 'remaining'].map((key) => (
						<div key={key} className='flex items-center justify-between'>
							<Skeleton className='h-5 w-20' />
							<Skeleton className='h-5 w-24' />
						</div>
					))}
				</div>
				<Skeleton className='mt-2 h-4 w-full' />
				<div className='mt-4 space-y-2'>
					<div className='flex justify-between'>
						<Skeleton className='h-4 w-14' />
						<Skeleton className='h-4 w-8' />
					</div>
					<Skeleton className='h-2 w-full rounded-full' />
				</div>
				<div className='mt-4 flex items-center justify-between border-t pt-3'>
					<Skeleton className='h-4 w-20' />
					<Skeleton className='h-4 w-24' />
				</div>
			</CardContent>
		</Card>
	)
}
