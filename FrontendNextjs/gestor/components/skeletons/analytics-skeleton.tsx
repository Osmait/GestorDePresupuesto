import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

/** Loading state of the Analysis page: mirrors the KPI row, the budget card and the 2×2 chart grid. */
export function AnalyticsSkeleton() {
	return (
		<div className='space-y-6' aria-busy='true'>
			<div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5'>
				{[1, 2, 3, 4, 5].map((i) => (
					<Card key={i} className='p-5'>
						<div className='flex items-start justify-between gap-3'>
							<Skeleton className='h-4 w-24' />
							<Skeleton className='h-4 w-4' />
						</div>
						<Skeleton className='mt-3 h-7 w-32' />
						<Skeleton className='mt-2 h-3 w-24' />
					</Card>
				))}
			</div>

			<Card>
				<CardHeader>
					<Skeleton className='h-6 w-48' />
				</CardHeader>
				<CardContent className='space-y-3'>
					{[1, 2, 3].map((i) => (
						<Skeleton key={i} className='h-16 w-full' />
					))}
				</CardContent>
			</Card>

			<div className='grid grid-cols-1 gap-4 lg:grid-cols-2'>
				{[64, 48, 56, 40].map((width) => (
					<Card key={width}>
						<CardHeader>
							<Skeleton className='h-6' style={{ width: `${width * 4}px` }} />
						</CardHeader>
						<CardContent>
							<Skeleton className='h-[300px] w-full' />
						</CardContent>
					</Card>
				))}
			</div>
		</div>
	)
}
