'use client'

import { useTranslations } from 'next-intl'
import { MonthlyPlanActions } from '@/components/monthly/MonthlyPlanActions'
import { MonthlyPlanBoard } from '@/components/monthly/MonthlyPlanBoard'
import { MonthlyPlanProvider } from '@/components/monthly/MonthlyPlanContext'
import { PageHeader } from '@/components/shared/PageHeader'
import { PageShell } from '@/components/shared/PageShell'

export default function MonthlyPlanPage() {
	const t = useTranslations('monthlyPlan')

	return (
		<MonthlyPlanProvider>
			<PageShell>
				<div id='monthly-plan-header'>
					<PageHeader
						title={t('title')}
						description={t('subtitle')}
						actionsId='add-monthly-plan-btn'
						actions={<MonthlyPlanActions />}
					/>
				</div>

				<div id='monthly-plan-board'>
					<MonthlyPlanBoard />
				</div>
			</PageShell>
		</MonthlyPlanProvider>
	)
}
