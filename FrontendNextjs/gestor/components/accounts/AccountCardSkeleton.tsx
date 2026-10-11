import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

/** Mirrors AccountCard: avatar + name/bank + menu, balance row, footer. */
export function AccountCardSkeleton() {
	return (
		<Card>
			<CardContent className='p-5'>
				<div className='mb-4 flex items-center justify-between gap-2'>
					<div className='flex items-center gap-3'>
						<Skeleton className='h-10 w-10 rounded-full' />
						<div className='space-y-2'>
							<Skeleton className='h-5 w-32' />
							<Skeleton className='h-4 w-24' />
						</div>
					</div>
					<Skeleton className='h-10 w-10 rounded-md' />
				</div>
				<div className='space-y-2'>
					<div className='flex items-center justify-between'>
						<Skeleton className='h-5 w-24' />
						<Skeleton className='h-8 w-32' />
					</div>
					<div className='flex items-center justify-between border-t pt-3'>
						<Skeleton className='h-4 w-10' />
						<Skeleton className='h-5 w-12 rounded-full' />
					</div>
				</div>
			</CardContent>
		</Card>
	)
}
