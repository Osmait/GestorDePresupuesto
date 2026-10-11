import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

/** Loading frame with the shape of the board: summary strip, ledger and month flow. */
export function MonthlyPlanSkeleton() {
	return (
		<div className='space-y-6' aria-busy='true'>
			<Card className='px-4 py-3.5 sm:px-6 sm:py-5' aria-hidden='true'>
				<div className='grid grid-cols-2 gap-x-4 gap-y-3 sm:gap-x-8 sm:gap-y-5 lg:grid-cols-4'>
					{[1, 2, 3, 4].map((i) => (
						<div key={i} className='space-y-2'>
							<Skeleton className='h-4 w-24' />
							<Skeleton className='h-6 w-32' />
						</div>
					))}
				</div>
			</Card>

			<div className='grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22.5rem]' aria-hidden='true'>
				<Card className='overflow-hidden'>
					<div className='flex flex-wrap items-center gap-3 border-b border-border px-4 py-3.5 sm:px-5'>
						<Skeleton className='mr-auto h-5 w-32' />
						<Skeleton className='h-10 w-full sm:w-52' />
						<Skeleton className='h-10 w-full sm:w-64' />
					</div>
					{[1, 2, 3, 4, 5, 6].map((i) => (
						<div key={i} className='flex items-center gap-3 border-b border-border px-4 py-3.5 sm:px-5'>
							<Skeleton className='h-4 w-4' />
							<Skeleton className='h-4 flex-1' />
							<Skeleton className='h-4 w-24' />
						</div>
					))}
				</Card>
				<Card className='space-y-4 p-4 sm:p-5'>
					<Skeleton className='h-5 w-32' />
					<Skeleton className='h-32 w-full' />
					<Skeleton className='h-16 w-full' />
				</Card>
			</div>
		</div>
	)
}
