'use client'

import { useTranslations } from 'next-intl'
import { Suspense } from 'react'
import { AnalysisActions } from '@/components/analysis/AnalysisActions'
import { AnalysisDashboard } from '@/components/analysis/AnalysisDashboard'
import { PageHeader } from '@/components/shared/PageHeader'
import { PageShell } from '@/components/shared/PageShell'
import { AnalyticsSkeleton } from '@/components/skeletons/analytics-skeleton'

/** Analytics report. Period and account live in the URL (`?period=2026-10&account=…`). */
export default function AnalysisPage() {
	const t = useTranslations('analysis')

	return (
		<PageShell>
			{/* useSearchParams (period/account) needs a Suspense boundary. */}
			<Suspense fallback={<PageHeader title={t('title')} description={t('subtitle')} />}>
				<PageHeader title={t('title')} description={t('subtitle')} actions={<AnalysisActions />} />
			</Suspense>
			<Suspense fallback={<AnalyticsSkeleton />}>
				<AnalysisDashboard />
			</Suspense>
		</PageShell>
	)
}
