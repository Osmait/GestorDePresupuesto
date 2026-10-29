'use client'

import { addDays, format } from 'date-fns'
import { CalendarIcon } from 'lucide-react'
import { useTranslations } from 'next-intl'
import * as React from 'react'
import { DateRange } from 'react-day-picker'
import { BREAKPOINTS, useMediaQuery } from '@/hooks/useMediaQuery'
import { useDateFnsLocale } from '@/lib/i18n/date-locale'
import { cn } from '@/lib/utils'
import { Button } from './ui/button'
import { Calendar } from './ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'

export function CalendarDateRangePicker({
	className,
	value,
	onChange,
}: Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> & {
	value?: DateRange | undefined
	onChange?: (_range: DateRange | undefined) => void
}) {
	const t = useTranslations('datePicker')
	const locale = useDateFnsLocale()
	// Two months side by side only where they fit.
	const isDesktop = useMediaQuery(BREAKPOINTS.lg)
	const [internalDate, setInternalDate] = React.useState<DateRange | undefined>({
		from: new Date(2023, 0, 20),
		to: addDays(new Date(2023, 0, 20), 20),
	})
	const date = value !== undefined ? value : internalDate
	const setDate = (range: DateRange | undefined) => {
		if (onChange) onChange(range)
		else setInternalDate(range)
	}

	return (
		<div className={cn('grid gap-2', className)}>
			<Popover>
				<PopoverTrigger asChild>
					<Button
						id='date'
						variant={'outline'}
						className={cn(
							'w-full justify-start text-left font-normal sm:w-auto sm:min-w-[260px]',
							!date && 'text-muted-foreground',
						)}
					>
						<CalendarIcon className='mr-2 h-4 w-4 shrink-0' aria-hidden='true' />
						{date?.from ? (
							date.to ? (
								<>
									{format(date.from, 'PP', { locale })} - {format(date.to, 'PP', { locale })}
								</>
							) : (
								format(date.from, 'PP', { locale })
							)
						) : (
							<span>{t('pickDate')}</span>
						)}
					</Button>
				</PopoverTrigger>
				<PopoverContent className='w-auto p-0' align='start'>
					<Calendar
						autoFocus
						locale={locale}
						mode='range'
						defaultMonth={date?.from}
						selected={date}
						onSelect={setDate}
						numberOfMonths={isDesktop ? 2 : 1}
					/>
				</PopoverContent>
			</Popover>
		</div>
	)
}
