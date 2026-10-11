'use client'

import { Plus } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useMonthlyPlanContext } from '@/components/monthly/MonthlyPlanContext'
import { Button } from '@/components/ui/button'

export function MonthlyPlanActions() {
	const t = useTranslations('monthlyPlan')
	const { openCreate } = useMonthlyPlanContext()

	return (
		<Button onClick={() => openCreate('bill')}>
			<Plus className='mr-2 h-4 w-4' aria-hidden='true' />
			{t('newItem')}
		</Button>
	)
}
