'use client'

import { useTranslations } from 'next-intl'
import { MonthlyPlanActions } from '@/components/monthly/MonthlyPlanActions'
import { MonthlyPlanBoard } from '@/components/monthly/MonthlyPlanBoard'
import { MonthlyPlanProvider } from '@/components/monthly/MonthlyPlanContext'

export default function MonthlyPlanPage() {
	const t = useTranslations('monthlyPlan')

	return (
		<MonthlyPlanProvider>
			<div className='min-h-screen bg-background'>
				<div className='container mx-auto px-4 py-8'>
					<div className='mb-8' id='monthly-plan-header'>
						<div className='flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4'>
							<div>
								<h1 className='text-4xl font-bold tracking-tight text-foreground'>{t('title')}</h1>
								<p className='text-muted-foreground mt-2 text-lg'>{t('subtitle')}</p>
							</div>
							<div id='add-monthly-plan-btn'>
								<MonthlyPlanActions />
							</div>
						</div>
					</div>

					<div id='monthly-plan-board'>
						<MonthlyPlanBoard />
					</div>
				</div>
			</div>
		</MonthlyPlanProvider>
	)
}
