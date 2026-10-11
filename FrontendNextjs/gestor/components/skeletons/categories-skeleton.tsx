import { StatGridSkeleton } from '@/components/shared/StatGrid'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

/** Mirrors CategoryList: three StatCards and the category card grid. */
export function CategoriesSkeleton() {
	return (
		<div className='space-y-6' aria-busy='true'>
			<StatGridSkeleton count={3} />
			<div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3'>
				{['sk-1', 'sk-2', 'sk-3', 'sk-4', 'sk-5', 'sk-6'].map((key) => (
					<Card key={key}>
						<CardContent className='p-5'>
							<div className='mb-4 flex items-start justify-between gap-2'>
								<div className='flex items-center gap-3'>
									<Skeleton className='h-10 w-10 rounded-full' />
									<div className='space-y-2'>
										<Skeleton className='h-5 w-32' />
										<Skeleton className='h-4 w-24' />
									</div>
								</div>
								<Skeleton className='h-10 w-10 rounded-md' />
							</div>
							<div className='flex items-center justify-between'>
								<Skeleton className='h-5 w-20' />
								<Skeleton className='h-7 w-28' />
							</div>
							<div className='mt-4 flex items-center justify-between border-t pt-3'>
								<Skeleton className='h-4 w-40' />
								<Skeleton className='h-5 w-16 rounded-full' />
							</div>
						</CardContent>
					</Card>
				))}
			</div>
		</div>
	)
}
