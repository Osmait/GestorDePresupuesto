import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export function MonthlyPlanSkeleton() {
	return (
		<div className='space-y-8'>
			<Card>
				<CardHeader>
					<Skeleton className='h-5 w-40' />
				</CardHeader>
				<CardContent>
					<div className='grid grid-cols-1 md:grid-cols-4 gap-4'>
						{[1, 2, 3, 4].map((i) => (
							<Skeleton key={i} className='h-24 w-full' />
						))}
					</div>
				</CardContent>
			</Card>

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
