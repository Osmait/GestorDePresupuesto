import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

function CardFrame({ rows, className }: { rows: number; className?: string }) {
	return (
		<div className={cn('space-y-4 rounded-lg border bg-card p-4 shadow-sm sm:p-5', className)}>
			<Skeleton className='h-5 w-40' />
			{Array.from({ length: rows }, (_, i) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: static placeholder rows
				<Skeleton key={i} className='h-10 w-full' />
			))}
		</div>
	)
}

/**
 * Loading state of the Analysis report: mirrors the hero (headline + three
 * figures), the two-column section rows and the trend/categories row.
 */
export function AnalyticsSkeleton() {
	return (
		<div className='space-y-6' aria-busy='true'>
			<div className='flex flex-wrap gap-x-10 gap-y-5 rounded-lg border bg-card p-4 shadow-sm sm:p-6'>
				<div className='min-w-0 flex-[3_1_420px] space-y-3'>
					<Skeleton className='h-4 w-36' />
					<Skeleton className='h-8 w-full max-w-md' />
					<Skeleton className='h-8 w-3/4 max-w-sm' />
					<Skeleton className='h-4 w-full max-w-lg' />
				</div>
				<div className='grid min-w-0 flex-[2_1_340px] grid-cols-2 gap-5 sm:grid-cols-3'>
					{[0, 1, 2].map((i) => (
						<div key={i} className={i === 2 ? 'hidden space-y-2 sm:block' : 'space-y-2'}>
							<Skeleton className='h-4 w-24' />
							<Skeleton className='h-6 w-28' />
							<Skeleton className='h-3 w-32' />
						</div>
					))}
				</div>
			</div>
			<div className='grid gap-6 lg:grid-cols-2'>
				<CardFrame rows={4} />
				<CardFrame rows={3} />
			</div>
			<div className='grid gap-6 lg:grid-cols-2'>
				<CardFrame rows={3} />
				<CardFrame rows={5} />
			</div>
			<div className='grid gap-6 lg:grid-cols-[3fr_2fr]'>
				<div className='space-y-4 rounded-lg border bg-card p-4 shadow-sm sm:p-5'>
					<Skeleton className='h-5 w-32' />
					<Skeleton className='h-48 w-full' />
				</div>
				<CardFrame rows={5} />
			</div>
		</div>
	)
}
