'use client'

import { PlusCircle } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useMonthlyPlanContext } from '@/components/monthly/MonthlyPlanContext'
import { Button } from '@/components/ui/button'

export function MonthlyPlanActions() {
	const t = useTranslations('monthlyPlan')
	const { openCreate } = useMonthlyPlanContext()

	return (
		<Button
			className='bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70'
			onClick={() => openCreate('bill')}
		>
			<PlusCircle className='h-4 w-4 mr-2' />
			{t('newItem')}
		</Button>
	)
}
