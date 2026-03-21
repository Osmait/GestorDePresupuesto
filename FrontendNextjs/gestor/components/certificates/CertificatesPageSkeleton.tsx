'use client'

import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export function CertificatesPageSkeleton() {
	return (
		<div className='space-y-6'>
			<div className='grid gap-4 md:grid-cols-2 lg:grid-cols-4'>
				{[1, 2, 3, 4].map((i) => (
					<Card key={i}>
						<CardHeader className='pb-2'>
							<Skeleton className='h-4 w-24' />
						</CardHeader>
						<CardContent>
							<Skeleton className='h-8 w-32' />
						</CardContent>
					</Card>
				))}
			</div>

			<div className='grid gap-4 md:grid-cols-2 lg:grid-cols-3'>
				{[1, 2, 3, 4, 5, 6].map((i) => (
					<Card key={i}>
						<CardHeader>
							<div className='flex justify-between'>
								<Skeleton className='h-6 w-32' />
								<Skeleton className='h-6 w-16' />
							</div>
						</CardHeader>
						<CardContent className='space-y-4'>
							<Skeleton className='h-20 w-full' />
							<div className='flex gap-2'>
								<Skeleton className='h-9 w-16' />
								<Skeleton className='h-9 w-16' />
								<Skeleton className='h-9 w-16' />
							</div>
						</CardContent>
					</Card>
				))}
			</div>
		</div>
	)
}
