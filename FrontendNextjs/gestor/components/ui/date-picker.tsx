'use client'

import { format } from 'date-fns'
import { Calendar as CalendarIcon } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useDateFnsLocale } from '@/lib/i18n/date-locale'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

interface DatePickerProps {
	value?: Date
	onChange: (date: Date | undefined) => void
	placeholder?: string
	disabled?: boolean
}

export function DatePicker({
	value,
	onChange,
	placeholder,
	disabled = false,
}: DatePickerProps) {
	const t = useTranslations('datePicker')
	const locale = useDateFnsLocale()
	return (
		<Popover>
			<PopoverTrigger asChild>
				<Button
					variant="outline"
					disabled={disabled}
					className={cn(
						'w-full justify-start text-left font-normal',
						!value && 'text-muted-foreground'
					)}
				>
					<CalendarIcon className="mr-2 h-4 w-4" />
					{value ? format(value, 'PPP', { locale }) : <span>{placeholder ?? t('pickDate')}</span>}
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-auto p-0" align="start">
				<Calendar
					mode="single"
					selected={value}
					onSelect={onChange}
					locale={locale}
					autoFocus
				/>
			</PopoverContent>
		</Popover>
	)
}
