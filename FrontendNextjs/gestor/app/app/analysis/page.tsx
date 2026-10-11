'use client'

import { useTranslations } from 'next-intl'
import { AnalysisActions } from '@/components/analysis/AnalysisActions'
import { AnalysisProvider } from '@/components/analysis/AnalysisContext'
import { AnalysisDashboard } from '@/components/analysis/AnalysisDashboard'
import { PageHeader } from '@/components/shared/PageHeader'
import { PageShell } from '@/components/shared/PageShell'

export default function AnalysisPage() {
	const t = useTranslations('analysis')

	return (
		<AnalysisProvider>
			<PageShell>
				<PageHeader title={t('title')} description={t('subtitle')} actions={<AnalysisActions />} />
				<AnalysisDashboard />
			</PageShell>
		</AnalysisProvider>
	)
}
