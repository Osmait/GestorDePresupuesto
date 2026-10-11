import { StatGridSkeleton } from '@/components/shared/StatGrid'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export function MonthlyPlanSkeleton() {
	return (
		<div className='space-y-6' aria-busy='true'>
			<StatGridSkeleton count={4} />

			<div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
				{[1, 2].map((column) => (
					<Card key={column}>
						<CardHeader>
							<Skeleton className='h-5 w-32' />
						</CardHeader>
						<CardContent className='space-y-3'>
							{[1, 2, 3].map((i) => (
								<Skeleton key={i} className='h-16 w-full' />
							))}
						</CardContent>
					</Card>
				))}
			</div>
		</div>
	)
}
