'use client'

import { useTranslations } from 'next-intl'
import { PageHeader } from '@/components/shared/PageHeader'
import { PageShell } from '@/components/shared/PageShell'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { CertificateSummaryCard } from './CertificateSummaryCard'

/** Loading layout of the certificates page: real title, skeleton KPIs and cards. */
export function CertificatesPageSkeleton() {
	const t = useTranslations('certificates')

	return (
		<PageShell aria-busy='true'>
			<PageHeader title={t('title')} description={t('subtitle')} />
			<CertificateSummaryCard summary={undefined} />

			<div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
				{[1, 2, 3].map((i) => (
					<Card key={i}>
						<CardHeader className='flex flex-row items-start justify-between space-y-0'>
							<div className='space-y-2'>
								<Skeleton className='h-5 w-32' />
								<Skeleton className='h-5 w-16' />
							</div>
							<Skeleton className='h-8 w-8' />
						</CardHeader>
						<CardContent className='space-y-4'>
							<Skeleton className='h-8 w-36' />
							<div className='grid grid-cols-2 gap-4'>
								<Skeleton className='h-9 w-full' />
								<Skeleton className='h-9 w-full' />
								<Skeleton className='h-9 w-full' />
								<Skeleton className='h-9 w-full' />
							</div>
						</CardContent>
					</Card>
				))}
			</div>
		</PageShell>
	)
}
